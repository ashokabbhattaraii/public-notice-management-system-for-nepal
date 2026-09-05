import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ScrapeSource } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScrapingService } from './scraping.service';
import { SettingsService, isValidCronExpression } from './settings.service';

/**
 * Bounded async semaphore — caps how many full crawls may run at once,
 * gated by the `scraping.concurrency` setting. Cheap sitemap checks do not
 * count against the budget; only heavyweight `runSource()` crawls do.
 */
class Semaphore {
  private queue: (() => void)[] = [];
  private active = 0;

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

/** How long a cached "no sitemap" verdict stands before it is re-checked. */
const SITEMAP_RECHECK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Automatic scraping scheduler.
 *
 * Ticks on the configured cron (default every minute) and:
 *  1. reclaims abandoned RUNNING runs (stale timeout) so crashed crawls don't
 *     wedge a source forever;
 *  2. finds enabled sources whose last poll is older than their
 *     pollIntervalSeconds (floored at the minimum-poll politeness guard),
 *     with no fresh RUNNING run in the DB;
 *  3. for each due source: one-time sitemap detection, a cheap sitemap poll
 *     (crawling only genuinely new URLs), or a full crawl — always through
 *     ScrapingService.runSource()/runSourceFromUrls().
 *
 * Tunables are read from the `scraping.*` app_settings catalog (with the env
 * fallbacks below) and re-applied on every tick and on admin save — cron and
 * concurrency changes apply live without a restart.
 */
@Injectable()
export class ScrapingSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(ScrapingSchedulerService.name);

  /** env-seeded fallbacks; overridden at runtime by `scraping.*` settings. */
  private readonly defaultCron: string;
  private readonly defaultConcurrency: number;
  private readonly defaultStaleRunTimeoutSeconds: number;
  private readonly defaultMinPollIntervalSeconds: number;
  private readonly defaultMaxBackoffSeconds: number;
  private readonly defaultFailureWindowSeconds: number;

  private cronExpression: string;
  private concurrency: number;
  private staleRunTimeoutSeconds: number;
  private minPollIntervalSeconds: number;
  /** Ceiling for the consecutive-failure backoff in findDueSources. */
  private maxBackoffSeconds: number;
  /** How far back findDueSources counts failures when sizing the backoff. */
  private failureWindowSeconds: number;
  private semaphore: Semaphore;
  private ticking = false;
  private lastTickAt: Date | null = null;
  private lastDueCount = 0;
  private autoScraping = true;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly scrapingService: ScrapingService,
    private readonly settings: SettingsService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.defaultCron =
      this.config.get<string>('SCRAPING_INTERVAL_CRON') || '0 * * * * *';
    this.defaultConcurrency =
      Number(this.config.get<string>('SCRAPING_CONCURRENCY')) || 3;
    this.defaultStaleRunTimeoutSeconds =
      Number(this.config.get<string>('SCRAPING_STALE_TIMEOUT_SECONDS')) || 3600;
    this.defaultMinPollIntervalSeconds =
      Number(this.config.get<string>('SCRAPING_MIN_POLL_INTERVAL_SECONDS')) || 60;
    this.defaultMaxBackoffSeconds =
      Number(this.config.get<string>('SCRAPING_MAX_BACKOFF_SECONDS')) || 21600;
    this.defaultFailureWindowSeconds =
      Number(this.config.get<string>('SCRAPING_FAILURE_WINDOW_SECONDS')) || 7200;

    this.cronExpression = this.defaultCron;
    this.concurrency = this.defaultConcurrency;
    this.staleRunTimeoutSeconds = this.defaultStaleRunTimeoutSeconds;
    this.minPollIntervalSeconds = this.defaultMinPollIntervalSeconds;
    this.maxBackoffSeconds = this.defaultMaxBackoffSeconds;
    this.failureWindowSeconds = this.defaultFailureWindowSeconds;
    this.semaphore = new Semaphore(this.defaultConcurrency);
  }

  /**
   * The @Cron decorator evaluates its argument at class-definition time (the
   * interval is always one minute even after env loads), so the real cron is
   * installed by `applyConfig()` once the module has initialised.
   */
  @Cron(CronExpression.EVERY_MINUTE, { name: 'scraping-tick' })
  async handleTick() {
    if (this.ticking) return; // never overlap with a previous long tick
    this.ticking = true;
    this.lastTickAt = new Date();
    try {
      await this.refreshTunings();
      this.autoScraping = await this.isAutoScrapingEnabled();
      if (!this.autoScraping) {
        this.lastDueCount = 0;
        return; // automatic scraping is switched off — manual runs only
      }
      await this.recoverStaleRuns();
      const due = await this.findDueSources();
      this.lastDueCount = due.length;
      if (due.length) {
        this.logger.log(`Scheduler tick: ${due.length} source(s) due for polling`);
      }
      for (const source of due) {
        // Sequential per source — checks are single GETs and the full-crawl
        // path is bounded by the semaphore, so this stays gentle.
        try {
          await this.pollSource(source);
        } catch (err: any) {
          this.logger.warn(
            `Poll failed for source ${source.name} (${source.id}): ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`Scheduler tick failed: ${err.message}`);
    } finally {
      this.ticking = false;
    }
  }

  onModuleInit() {
    return this.applyConfig();
  }

  /**
   * Re-read `scraping.*` app_settings and apply the deltas: rebuild the crawl
   * semaphore when the concurrency cap changed, re-register the cron job when
   * the expression changed. Called at startup and after every settings save,
   * so tunables take effect without a restart.
   */
  async applyConfig() {
    const cron = await this.settings.getEffective('scraping.cron');
    const concurrency = await this.settings.getNumber(
      'scraping.concurrency',
      this.defaultConcurrency,
    );
    const stale = await this.settings.getNumber(
      'scraping.staleTimeoutSec',
      this.defaultStaleRunTimeoutSeconds,
    );
    const minPoll = await this.settings.getNumber(
      'scraping.minPollSec',
      this.defaultMinPollIntervalSeconds,
    );

    this.staleRunTimeoutSeconds = stale;
    this.minPollIntervalSeconds = minPoll;

    if (concurrency !== this.concurrency) {
      this.concurrency = concurrency;
      this.semaphore = new Semaphore(concurrency);
      this.logger.log(`Scheduler concurrency -> ${concurrency}`);
    }

    if (isValidCronExpression(cron) && cron !== this.cronExpression) {
      this.cronExpression = cron;
      this.reapplyCron();
      this.logger.log(`Scheduler cron -> "${cron}"`);
    }

    return this.getSchedulerStatus();
  }

  /** Re-register the cron job (settings or env driven expression). */
  private reapplyCron() {
    try {
      this.schedulerRegistry.deleteCronJob('scraping-tick');
    } catch {
      // not currently registered — safe to add
    }
    const job = new CronJob(this.cronExpression, () => void this.handleTick());
    this.schedulerRegistry.addCronJob('scraping-tick', job);
    job.start();
  }

  /**
   * Tick-time re-read of the politeness/staleness floors only (the two
   * scheduler inputs that affect each run's decision without needing a job
   * re-registration).
   */
  private async refreshTunings() {
    this.staleRunTimeoutSeconds = await this.settings.getNumber(
      'scraping.staleTimeoutSec',
      this.defaultStaleRunTimeoutSeconds,
    );
    this.minPollIntervalSeconds = await this.settings.getNumber(
      'scraping.minPollSec',
      this.defaultMinPollIntervalSeconds,
    );
    this.maxBackoffSeconds = await this.settings.getNumber(
      'scraping.maxBackoffSec',
      this.defaultMaxBackoffSeconds,
    );
    this.failureWindowSeconds = await this.settings.getNumber(
      'scraping.failureWindowSec',
      this.defaultFailureWindowSeconds,
    );
  }

  /** Effective scheduler settings + last-tick state, surfaced in the admin UI. */
  getSchedulerStatus() {
    return {
      cron: this.cronExpression,
      concurrency: this.concurrency,
      staleRunTimeoutSeconds: this.staleRunTimeoutSeconds,
      minPollIntervalSeconds: this.minPollIntervalSeconds,
      maxBackoffSeconds: this.maxBackoffSeconds,
      ticking: this.ticking,
      autoScraping: this.autoScraping,
      lastTickAt: this.lastTickAt?.toISOString() ?? null,
      lastDueCount: this.lastDueCount,
    };
  }

  /** Persisted global on/off switch for automatic scraping (default: on). */
  async isAutoScrapingEnabled(): Promise<boolean> {
    return this.settings.getBoolean('scraping.enabled', true);
  }

  /** Flip the persisted global auto-scraping switch. Manual runs are unaffected. */
  async setAutoScraping(enabled: boolean): Promise<void> {
    this.autoScraping = enabled;
    await this.settings.set('scraping.enabled', enabled ? 'true' : 'false');
  }

  /** Mark abandoned RUNNING runs as FAILED so their sources become pollable. */
  private async recoverStaleRuns() {
    const recovered = await this.scrapingService.recoverStaleRuns();
    if (recovered > 0) {
      this.logger.warn(`Scheduler reclaimed ${recovered} stale run(s)`);
    }
  }

  /**
   * Enabled sources whose last poll is older than their interval, and with
   * no live RUNNING run. Uses a raw query because the interval is a per-row
   * column (GREATEST with the politeness floor); the RUNNING-run subquery is
   * the DB-backed concurrency lock.
   *
   * A source that keeps failing backs off exponentially (doubling per
   * consecutive failure since its last success, capped at maxBackoffSeconds)
   * instead of retrying on its base interval forever. A permanently broken
   * source used to burn thousands of runs a day, which is what starved the
   * AI service's browser pool and took the healthy sources down with it.
   */
  private async findDueSources(): Promise<ScrapeSource[]> {
    return this.prisma.$queryRaw<ScrapeSource[]>`
      SELECT s.*
      FROM scrape_sources s
      CROSS JOIN LATERAL (
        SELECT count(*)::int AS consecutive_failures
        FROM scrape_runs r
        WHERE r.source_id = s.id
          AND r.status = 'FAILED'
          AND r.started_at > GREATEST(
            COALESCE(
              (SELECT max(ok.started_at) FROM scrape_runs ok
               WHERE ok.source_id = s.id AND ok.status = 'SUCCESS'),
              '-infinity'::timestamp
            ),
            -- Only recent failures count, so a source that was broken by an
            -- outage on our side isn't held at the ceiling once it's fixed.
            now() - make_interval(secs => ${this.failureWindowSeconds})
          )
      ) f
      WHERE s.enabled = true
        AND NOT s.is_ad_hoc
        AND (
          s.last_run_at IS NULL
          OR s.last_run_at <= now() - make_interval(
            secs => LEAST(
              GREATEST(s.poll_interval_seconds, ${this.minPollIntervalSeconds})
                * POWER(2, LEAST(f.consecutive_failures, 10))::int,
              ${this.maxBackoffSeconds}
            )
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM scrape_runs r
          WHERE r.source_id = s.id
            AND r.status = 'RUNNING'
            AND r.started_at > now() - make_interval(
              secs => ${this.staleRunTimeoutSeconds}
            )
        )
      ORDER BY s.last_run_at ASC NULLS FIRST
      LIMIT 50
    `;
  }

  /** Decide what one due source needs this tick: one-time sitemap detection,
   * a cheap sitemap check, or a full crawl. */
  private async pollSource(source: ScrapeSource) {
    // A "no sitemap" verdict is cached forever, so a source whose sitemap was
    // merely unreadable at the time (gzipped, or the portal was down) would
    // pay for full crawls indefinitely. Re-check stale verdicts periodically
    // so the pipeline self-heals instead of needing a manual admin action.
    if (
      !source.sitemapUrl &&
      source.sitemapCheckedAt &&
      Date.now() - source.sitemapCheckedAt.getTime() > SITEMAP_RECHECK_MS
    ) {
      const detected = await this.scrapingService.detectSitemap(source.id);
      if (detected.sitemapUrl) {
        this.logger.log(
          `Sitemap re-detected for ${source.name}: ${detected.sitemapUrl}`,
        );
        return this.pollSitemap(source.id);
      }
      return this.pollListing(source);
    }

    // Sitemap never attempted → detect exactly once and cache the verdict.
    if (!source.sitemapUrl && !source.sitemapCheckedAt) {
      const detected = await this.scrapingService.detectSitemap(source.id);
      this.logger.log(
        `Sitemap detection for ${source.name}: ${detected.sitemapUrl ?? 'none — HTML-poll only'}`,
      );
      if (!detected.sitemapUrl) {
        // No sitemap — fall back to the listing probe, which is nearly as
        // cheap and works on any site.
        return this.pollListing(source);
      }
      // Fall through to the sitemap fast-path with the fresh URL.
      return this.pollSitemap(source.id);
    }

    if (source.sitemapUrl) {
      return this.pollSitemap(source.id);
    }

    // HTML-only source: probe the listing page cheaply rather than paying for
    // a full crawl on every interval.
    return this.pollListing(source);
  }

  /**
   * Cheap listing poll for sources with no sitemap — the HTML equivalent of
   * pollSitemap. One listing-page fetch per category (no detail pages, OCR or
   * LLM); a crawl is enqueued only for URLs that are genuinely new. This is
   * what lets HTML-only sources be polled every couple of minutes instead of
   * every 15, without the load a full crawl would imply.
   *
   * Falls back to a full crawl if the probe itself fails, so a broken probe
   * degrades to the old behaviour rather than silently starving the source.
   */
  private async pollListing(source: ScrapeSource) {
    try {
      const result = await this.scrapingService.checkListing(source.id);
      const newCount = result.new_urls?.length ?? 0;
      if (newCount > 0) {
        this.logger.log(
          `Listing for ${source.name} shows ${newCount} new URL(s) — crawling them directly`,
        );
        return this.enqueueUrlScrape(source.id, result.new_urls);
      }
      await this.scrapingService.markSourcePolled(source.id);
    } catch (err: any) {
      this.logger.warn(
        `Listing probe failed for ${source.name} (${err.message}) — falling back to full crawl`,
      );
      return this.enqueueFullScrape(source.id);
    }
  }

  /**
   * Cheap sitemap poll: one GET for <loc>s not yet in the DB. A full crawl
   * happens only when genuinely new URLs show up; otherwise the poll itself
   * satisfies the interval (markSourcePolled) so we don't re-hit the sitemap
   * every 60s tick.
   */
  private async pollSitemap(sourceId: string) {
    const result = await this.scrapingService.checkSitemap(sourceId);
    const newCount = result.new_urls?.length ?? 0;
    if (newCount > 0) {
      this.logger.log(
        `Sitemap for ${sourceId} shows ${newCount} new URL(s) — crawling them directly`,
      );
      return this.enqueueUrlScrape(sourceId, result.new_urls);
    }
    await this.scrapingService.markSourcePolled(sourceId);
  }

  /** Full crawl through the standard execution path, bounded by the semaphore. */
  private async enqueueFullScrape(sourceId: string) {
    await this.semaphore.acquire();
    try {
      await this.scrapingService.runSource(sourceId);
    } catch (err: any) {
      // Already-running conflicts (e.g. a manual run started between the due
      // check and here) are expected and harmless.
      this.logger.warn(`Full scrape skipped for ${sourceId}: ${err.message}`);
    } finally {
      this.semaphore.release();
    }
  }

  /**
   * Sitemap-driven crawl: the sitemap already enumerated the exact new URLs,
   * so fetch those detail pages directly (runSourceFromUrls). This is the
   * path that keeps data flowing for sites whose /category/* listing pages
   * 404 but whose sitemap is healthy (e.g. mohp.gov.np).
   */
  private async enqueueUrlScrape(sourceId: string, urls: string[]) {
    await this.semaphore.acquire();
    try {
      await this.scrapingService.runSourceFromUrls(sourceId, urls);
    } catch (err: any) {
      this.logger.warn(`Sitemap URL scrape skipped for ${sourceId}: ${err.message}`);
    } finally {
      this.semaphore.release();
    }
  }
}