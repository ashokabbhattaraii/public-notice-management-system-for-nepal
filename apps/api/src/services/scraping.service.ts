import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  ScrapedItemCategory,
  ScrapeRunStatus,
  ScrapePaginationType,
  ScrapeSource,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from './settings.service';
import * as crypto from 'crypto';

interface RawAttachment {
  url: string;
  label: string | null;
  mime_type: string | null;
  size_bytes: number | null;
}

interface RawScrapedItem {
  category: string;
  title: string;
  source_url: string;
  published_at: string | null;
  summary: string | null;
  content_text: string | null;
  content_html: string | null;
  attachment_url: string | null;
  source_slug: string | null;
  attachments: RawAttachment[];
  ai_summary: string | null;
  ai_summary_ne: string | null;
  ai_urgency: string | null;
  ai_category_confidence: number | null;
  metadata: Record<string, unknown> | null;
}

export interface CreateScrapeSourceInput {
  name: string;
  baseUrl: string;
  noticeListUrl?: string | null;
  newsListUrl?: string | null;
  pressReleaseListUrl?: string | null;
  paginationType?: ScrapePaginationType;
  paginationParam?: string;
  startPage?: number;
  maxPages?: number;
  pollIntervalSeconds?: number;
  sitemapUrl?: string | null;
}

export interface UpdateScrapeSourceInput {
  name?: string;
  baseUrl?: string;
  noticeListUrl?: string | null;
  newsListUrl?: string | null;
  pressReleaseListUrl?: string | null;
  enabled?: boolean;
  paginationType?: ScrapePaginationType;
  paginationParam?: string;
  startPage?: number;
  maxPages?: number;
  pollIntervalSeconds?: number;
  sitemapUrl?: string | null;
}

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);
  private readonly aiServiceUrl: string;
  // A run is considered abandoned (API crashed mid-crawl, etc.) after this
  // many seconds; the scheduler then reclaims it as FAILED so the source can
  // be polled again. The actual per-source concurrency lock is the DB: a
  // RUNNING ScrapeRun row newer than this timeout (see #findActiveRun) —
  // survives API restarts and works across multiple API replicas.
  private readonly staleRunTimeoutSeconds: number;
  // Interval used as the *effective floor* for auto-polling when the admin
  // sets a sitemap fast-path below what politeness allows.
  private readonly minPollIntervalSeconds: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {
    this.aiServiceUrl =
      this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
    this.staleRunTimeoutSeconds =
      Number(this.config.get<string>('SCRAPING_STALE_TIMEOUT_SECONDS')) || 3600;
    this.minPollIntervalSeconds =
      Number(this.config.get<string>('SCRAPING_MIN_POLL_INTERVAL_SECONDS')) || 60;
  }

  // --- Source CRUD ---

  async listSources() {
    const sources = await this.prisma.scrapeSource.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { items: true } } },
    });
    return sources.map((s) => ({ ...s, itemCount: s._count.items, _count: undefined }));
  }

  async getSource(id: string) {
    const source = await this.prisma.scrapeSource.findUnique({ where: { id } });
    if (!source) throw new NotFoundException(`Scrape source ${id} not found`);
    return source;
  }

  async createSource(input: CreateScrapeSourceInput) {
    if (!input.noticeListUrl && !input.newsListUrl && !input.pressReleaseListUrl) {
      throw new ConflictException(
        'At least one listing URL (notice, news, or press release) is required',
      );
    }
    return this.prisma.scrapeSource.create({
      data: {
        name: input.name,
        baseUrl: input.baseUrl,
        noticeListUrl: input.noticeListUrl || null,
        newsListUrl: input.newsListUrl || null,
        pressReleaseListUrl: input.pressReleaseListUrl || null,
        ...(input.paginationType ? { paginationType: input.paginationType } : {}),
        ...(input.paginationParam ? { paginationParam: input.paginationParam } : {}),
        ...(input.startPage ? { startPage: input.startPage } : {}),
        ...(input.maxPages ? { maxPages: input.maxPages } : {}),
        pollIntervalSeconds:
          input.pollIntervalSeconds ??
          (input.sitemapUrl ? 180 : 900),
        sitemapUrl: input.sitemapUrl || null,
        ...(input.sitemapUrl ? { sitemapCheckedAt: new Date() } : {}),
      },
    });
  }

  async updateSource(id: string, input: UpdateScrapeSourceInput) {
    await this.getSource(id);
    const data: Prisma.ScrapeSourceUpdateInput = {
      ...input,
      // Listing URL changes invalidate any cached extraction schema for that
      // category — the old selectors were derived from the old page.
      ...(input.noticeListUrl !== undefined ? { noticeSchema: Prisma.JsonNull } : {}),
      ...(input.newsListUrl !== undefined ? { newsSchema: Prisma.JsonNull } : {}),
      ...(input.pressReleaseListUrl !== undefined
        ? { pressReleaseSchema: Prisma.JsonNull }
        : {}),
    };
    // A base-URL change invalidates a cached sitemap too — the old one may
    // belong to a different host entirely.
    if (input.baseUrl !== undefined) {
      data.sitemapUrl = null;
      data.sitemapCheckedAt = null;
    }
    // Clearing the sitemap URL also clears the "detected once" flag so a
    // future detection can run again.
    if (input.sitemapUrl === null) {
      data.sitemapCheckedAt = null;
    } else if (input.sitemapUrl !== undefined) {
      data.sitemapUrl = input.sitemapUrl;
      data.sitemapCheckedAt = new Date();
    }
    return this.prisma.scrapeSource.update({ where: { id }, data });
  }

  async deleteSource(id: string) {
    await this.getSource(id);
    await this.prisma.scrapeSource.delete({ where: { id } });
    return { deleted: true };
  }

  // --- Run ---

  /**
   * Trigger a scrape run for one source. Returns immediately with the run id
   * so the admin UI can poll live progress messages while the (potentially
   * multi-page, multi-detail-fetch) crawl runs in the background — mirrors
   * the fire-and-forget pattern used for document ingestion.
   *
   * Concurrency is guarded by the DB rather than an in-memory Set: a fresh
   * RUNNING ScrapeRun row acts as the lock, so it survives API restarts and
   * holds even if the API is scaled to multiple replicas.
   */
  async runSource(id: string, categories?: ('NOTICE' | 'NEWS' | 'PRESS_RELEASE')[]) {
    const source = await this.getSource(id);
    if (!source.enabled) {
      throw new ConflictException('This source is disabled');
    }
    const active = await this.findActiveRun(id);
    if (active) {
      throw new ConflictException(
        `A scrape run is already in progress for this source (started ${active.startedAt.toISOString()})`,
      );
    }

    const run = await this.prisma.scrapeRun.create({
      data: { sourceId: id, sourceLabel: source.name, status: ScrapeRunStatus.RUNNING },
    });

    this.executeRun(run.id, source, categories).catch((err: any) => {
      this.logger.error(`Unhandled error in scrape run ${run.id}: ${err.message}`);
    });

    return { runId: run.id };
  }

  /**
   * Sitemap-driven full crawl: scrape the exact <loc> URLs a sitemap check
   * already reported as new, directly as detail pages — no listing-page
   * crawl. Some sites' category URLs 404 while their sitemap stays healthy
   * (mohp.gov.np serves only an SVG error page at /category/*); for those
   * the listing crawl yields zero items, so the sitemap URLs ARE the crawl.
   */
  async runSourceFromUrls(id: string, urls: string[]) {
    const source = await this.getSource(id);
    if (!source.enabled) {
      throw new ConflictException('This source is disabled');
    }
    if (!urls.length) {
      throw new ConflictException('No URLs to scrape');
    }
    const active = await this.findActiveRun(id);
    if (active) {
      throw new ConflictException(
        `A scrape run is already in progress for this source (started ${active.startedAt.toISOString()})`,
      );
    }

    const run = await this.prisma.scrapeRun.create({
      data: { sourceId: id, sourceLabel: source.name, status: ScrapeRunStatus.RUNNING },
    });

    this.executeRunFromUrls(run.id, source, urls).catch((err: any) => {
      this.logger.error(`Unhandled error in sitemap scrape run ${run.id}: ${err.message}`);
    });

    return { runId: run.id };
  }

  /**
   * Convenience bulk trigger for the admin UI: runs every enabled source that
   * isn't already (freshly) RUNNING. Each source goes through the same
   * runSource() path — the DB-backed lock prevents overlap, and disabled or
   * busy sources are reported rather than erroring the whole batch.
   */
  async runAllSources(categories?: ('NOTICE' | 'NEWS' | 'PRESS_RELEASE')[]) {
    const sources = await this.prisma.scrapeSource.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const results: {
      sourceId: string;
      sourceName: string;
      runId: string | null;
      status: 'scheduled' | 'already-running' | 'disabled';
    }[] = [];

    for (const source of sources) {
      if (!source.enabled) {
        results.push({ sourceId: source.id, sourceName: source.name, runId: null, status: 'disabled' });
        continue;
      }
      const active = await this.findActiveRun(source.id);
      if (active) {
        results.push({ sourceId: source.id, sourceName: source.name, runId: null, status: 'already-running' });
        continue;
      }
      try {
        const { runId } = await this.runSource(source.id, categories);
        results.push({ sourceId: source.id, sourceName: source.name, runId, status: 'scheduled' });
      } catch {
        // A source could race into a RUNNING state between the check above
        // and runSource — never fail the whole batch for that.
        results.push({ sourceId: source.id, sourceName: source.name, runId: null, status: 'already-running' });
      }
    }

    return {
      scheduled: results.filter((r) => r.status === 'scheduled').length,
      skipped: results.length - results.filter((r) => r.status === 'scheduled').length,
      results,
    };
  }

  /**
   * The DB-backed per-source lock: the most recent RUNNING run for the
   * source, if it started within the stale-run window. Any RUNNING row older
   * than the window is treated as an abandoned run (crashed process) and
   * does not block a fresh run.
   */
  async findActiveRun(sourceId: string) {
    return this.prisma.scrapeRun.findFirst({
      where: {
        sourceId,
        status: ScrapeRunStatus.RUNNING,
        startedAt: { gte: new Date(Date.now() - this.staleRunTimeoutSeconds * 1000) },
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Reclaim abandoned RUNNING runs (API crashed mid-crawl) as FAILED so the
   * scheduler can poll the source again. Safe to call repeatedly; a no-op
   * when there is nothing stale.
   */
  async recoverStaleRuns() {
    const cutoff = new Date(Date.now() - this.staleRunTimeoutSeconds * 1000);
    const stale = await this.prisma.scrapeRun.findMany({
      where: { status: ScrapeRunStatus.RUNNING, startedAt: { lt: cutoff } },
    });
    for (const run of stale) {
      this.logger.warn(
        `Reclaiming stale scrape run ${run.id} (started ${run.startedAt.toISOString()}) as FAILED`,
      );
      await this.prisma.scrapeRun.update({
        where: { id: run.id },
        data: {
          status: ScrapeRunStatus.FAILED,
          error: `Abandoned run reclaimed by scheduler (started ${run.startedAt.toISOString()})`,
          finishedAt: new Date(),
        },
      });
      // Bump the source so it becomes eligible again without a re-scrape
      // storm on the very next tick.
      if (run.sourceId) {
        await this.prisma.scrapeSource.update({
          where: { id: run.sourceId },
          data: { lastRunAt: new Date(), lastStatus: ScrapeRunStatus.FAILED },
        });
      }
    }
    return stale.length;
  }

  /**
   * Record that the scheduler polled a source's sitemap and found nothing
   * new — the poll itself satisfies the interval, so lastRunAt advances but
   * no ScrapeRun row is created (a check is not a scrape).
   */
  async markSourcePolled(id: string) {
    return this.prisma.scrapeSource.update({
      where: { id },
      data: { lastRunAt: new Date() },
    });
  }

  /**
   * One-time sitemap detection for a source (the cheap fast-path). Persists
   * the winning sitemap URL — or caches null so detection is never retried
   * every tick — and returns the updated source. Tightens the poll interval
   * from the slow HTML default to the fast 3-min cadence when a sitemap is
   * found, since the source can now be probed cheaply.
   */
  async detectSitemap(id: string) {
    const source = await this.getSource(id);
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.aiServiceUrl}/scrape/sitemap/detect`,
        { base_url: source.baseUrl },
        { timeout: 30000 },
      ),
    );
    const sitemapUrl: string | null = response.data?.sitemap_url || null;
    const checkedAt = new Date(response.data?.checked_at || Date.now());
    this.logger.log(
      `Sitemap detection for ${source.name}: ${sitemapUrl ? `found ${sitemapUrl}` : 'no usable sitemap'}`,
    );
    return this.prisma.scrapeSource.update({
      where: { id },
      data: {
        sitemapUrl,
        sitemapCheckedAt: checkedAt,
        // A sitemap fast-path makes cheap polling possible — tighten the
        // interval so new notices surface sooner, unless the admin already
        // set a custom cadence.
        ...(sitemapUrl && source.pollIntervalSeconds >= 900
          ? { pollIntervalSeconds: 180 }
          : {}),
      },
    });
  }

  /**
   * Cheap sitemap poll: asks the AI service for the sitemap's <loc> entries
   * that are not yet known to this source. No crawl4ai/Playwright involved.
   * Returns { sitemap_url, checked_at, new_urls, total_locs }.
   */
  async checkSitemap(id: string) {
    const source = await this.getSource(id);
    if (!source.sitemapUrl) {
      throw new ConflictException('This source has no sitemap URL configured');
    }
    const knownUrls = (
      await this.prisma.scrapedItem.findMany({
        where: { sourceId: id },
        select: { sourceUrl: true },
      })
    ).map((r) => r.sourceUrl);
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.aiServiceUrl}/scrape/check`,
        {
          base_url: source.baseUrl,
          sitemap_url: source.sitemapUrl,
          known_urls: knownUrls,
        },
        { timeout: 30000 },
      ),
    );
    return response.data as {
      sitemap_url: string | null;
      checked_at: string;
      new_urls: string[];
      total_locs: number;
    };
  }

  /** The actual crawl + persistence, run detached from the triggering request. */
  private async executeRun(
    runId: string,
    source: ScrapeSource,
    categories?: ('NOTICE' | 'NEWS' | 'PRESS_RELEASE')[],
  ) {
    try {
      const categoryUrls: Record<string, string> = {};
      const wantedCategories = categories ?? ['NOTICE', 'NEWS', 'PRESS_RELEASE'];
      if (wantedCategories.includes('NOTICE') && source.noticeListUrl) {
        categoryUrls.NOTICE = source.noticeListUrl;
      }
      if (wantedCategories.includes('NEWS') && source.newsListUrl) {
        categoryUrls.NEWS = source.newsListUrl;
      }
      if (wantedCategories.includes('PRESS_RELEASE') && source.pressReleaseListUrl) {
        categoryUrls.PRESS_RELEASE = source.pressReleaseListUrl;
      }
      if (Object.keys(categoryUrls).length === 0) {
        throw new ConflictException(
          'This source has no listing URL configured for the requested categories',
        );
      }

      const knownUrls = (
        await this.prisma.scrapedItem.findMany({
          where: { sourceId: source.id },
          select: { sourceUrl: true },
        })
      ).map((r) => r.sourceUrl);

      // Admin-tunable (SettingsService) — how many items the AI service may
      // summarize in parallel. Read per-run so an admin change applies on the
      // next poll without a restart.
      const summarizeConcurrency = await this.settings.getNumber(
        'scraping.summarizeConcurrency',
        2,
      );

      const cachedSchemas: Record<string, unknown> = {};
      if (source.noticeSchema) cachedSchemas.NOTICE = source.noticeSchema;
      if (source.newsSchema) cachedSchemas.NEWS = source.newsSchema;
      if (source.pressReleaseSchema) cachedSchemas.PRESS_RELEASE = source.pressReleaseSchema;

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/scrape/source`,
          {
            base_url: source.baseUrl,
            category_urls: categoryUrls,
            cached_schemas: cachedSchemas,
            known_urls: knownUrls,
            max_pages: source.maxPages,
            summarize_concurrency: summarizeConcurrency,
            run_id: runId,
            pagination: {
              type: source.paginationType,
              param: source.paginationParam,
              start_page: source.startPage,
            },
          },
          { timeout: 600000 },
        ),
      );

      const items: RawScrapedItem[] = response.data.items ?? [];
      const schemas: Record<string, unknown> = response.data.schemas ?? {};

      // Listing crawl produced nothing but a sitemap exists — some sites'
      // category URLs 404 while the sitemap stays healthy (mohp.gov.np).
      // Fall back to crawling the sitemap's new URLs directly so a manual
      // "Run now" still yields data for these sources.
      if (items.length === 0 && source.sitemapUrl) {
        this.logger.log(
          `Listing crawl for ${source.name} yielded 0 items; falling back to sitemap URLs`,
        );
        const check = await this.checkSitemap(source.id);
        const newUrls: string[] = check.new_urls ?? [];
        if (newUrls.length) {
          const sitemapResponse = await firstValueFrom(
            this.httpService.post(
              `${this.aiServiceUrl}/scrape/sitemap-crawl`,
              {
                base_url: source.baseUrl,
                urls: newUrls,
                known_urls: knownUrls,
                summarize_concurrency: summarizeConcurrency,
                run_id: runId,
              },
              { timeout: 600000 },
            ),
          );
          const sitemapItems: RawScrapedItem[] = sitemapResponse.data.items ?? [];
          if (sitemapItems.length) {
            const freshIds = await this.persistItems(runId, source, sitemapItems, schemas);
            if (freshIds.length) {
              this.embedNewNotices(source.id, freshIds).catch((err: any) => {
                this.logger.warn(`Background embedding failed: ${err.message}`);
              });
            }
            return;
          }
        }
      }

      const freshIds = await this.persistItems(runId, source, items, schemas);

      // Embed newly summarized notices into vector store (fire-and-forget)
      if (freshIds.length) {
        this.embedNewNotices(source.id, freshIds).catch((err: any) => {
          this.logger.warn(`Background embedding failed: ${err.message}`);
        });
      }
    } catch (err: any) {
      this.logger.error(`Scrape run failed for source ${source.id}: ${err.message}`);
      await this.prisma.scrapeRun.update({
        where: { id: runId },
        data: {
          status: ScrapeRunStatus.FAILED,
          error: err.message,
          finishedAt: new Date(),
        },
      });
      await this.prisma.scrapeSource.update({
        where: { id: source.id },
        data: { lastRunAt: new Date(), lastStatus: ScrapeRunStatus.FAILED },
      });
    }
  }

  /**
   * Execution path for runSourceFromUrls: POST the sitemap's new URLs to the
   * AI service's /scrape/sitemap-crawl, then persist items through the exact
   * same dedup/attachment/summarize pipeline as a listing crawl (share code
   * via a private persistItems helper).
   */
  private async executeRunFromUrls(
    runId: string,
    source: ScrapeSource,
    urls: string[],
  ) {
    try {
      const knownUrls = (
        await this.prisma.scrapedItem.findMany({
          where: { sourceId: source.id },
          select: { sourceUrl: true },
        })
      ).map((r) => r.sourceUrl);

      const summarizeConcurrency = await this.settings.getNumber(
        'scraping.summarizeConcurrency',
        2,
      );

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/scrape/sitemap-crawl`,
          {
            base_url: source.baseUrl,
            urls,
            known_urls: knownUrls,
            summarize_concurrency: summarizeConcurrency,
            run_id: runId,
          },
          { timeout: 600000 },
        ),
      );

      const items: RawScrapedItem[] = response.data.items ?? [];
      const freshIds = await this.persistItems(runId, source, items, {});

      // Embed newly summarized notices into vector store (fire-and-forget)
      if (freshIds.length) {
        this.embedNewNotices(source.id, freshIds).catch((err: any) => {
          this.logger.warn(`Background embedding failed: ${err.message}`);
        });
      }
    } catch (err: any) {
      this.logger.error(`Sitemap scrape run failed for source ${source.id}: ${err.message}`);
      await this.prisma.scrapeRun.update({
        where: { id: runId },
        data: {
          status: ScrapeRunStatus.FAILED,
          error: err.message,
          finishedAt: new Date(),
        },
      });
      await this.prisma.scrapeSource.update({
        where: { id: source.id },
        data: { lastRunAt: new Date(), lastStatus: ScrapeRunStatus.FAILED },
      });
    }
  }

  /**
   * Shared persistence pipeline for both crawl modes (listing and sitemap):
   * dedup against existing items, create/update rows + attachments,
   * trigger PDF extraction / LLM analysis where needed, record run and
   * source status. `schemas` is only saved to the source by the listing
   * crawl; the sitemap crawl passes an empty object. Returns the IDs of
   * notices that received a fresh AI summary this run — callers embed only
   * those into the vector store instead of re-embedding the whole corpus.
   */
  private async persistItems(
    runId: string,
    source: ScrapeSource,
    items: RawScrapedItem[],
    schemas: Record<string, unknown>,
  ): Promise<string[]> {
    // One batch lookup instead of one findUnique per item — the dedup
    // check itself shouldn't be N database round-trips.
    const existingItems = await this.prisma.scrapedItem.findMany({
      where: { sourceUrl: { in: items.map((i) => i.source_url) } },
    });
    const existingByUrl = new Map(existingItems.map((i) => [i.sourceUrl, i]));

    let itemsNew = 0;
    let itemsUpdated = 0;
    let itemsSkipped = 0;
    let itemsSummarized = 0;
    let itemsSummaryFailed = 0;
    const freshlySummarizedIds: string[] = [];

    const validCategories = new Set([
      'NOTICE', 'NEWS', 'PRESS_RELEASE', 'CIRCULAR', 'TENDER', 'VACANCY', 'JOB', 'INTERNSHIP', 'OTHER',
    ]);

    for (const item of items) {
      const contentHash = crypto
        .createHash('sha256')
        .update(`${item.title}|${item.content_text ?? ''}`)
        .digest('hex');

      const resolvedCategory = validCategories.has(item.category)
        ? (item.category as ScrapedItemCategory)
        : ScrapedItemCategory.OTHER;

      // Track AI summarization status from the Python service
      if (item.ai_summary) {
        itemsSummarized++;
      } else if (item.content_text) {
        itemsSummaryFailed++;
      }

      const existing = existingByUrl.get(item.source_url);

      // A content hash is only meaningful when the item's detail page was
      // actually re-fetched this run. Known URLs are skipped by the scraper
      // (`fetch_detail` only runs for unknown URLs), so `content_text` is
      // null for them — hashing `title|` against the stored `title|content`
      // would always differ and rewrite every row + its attachments on every
      // poll. Only run the content-changed path on fresh content.
      const hasFreshContent = item.content_text != null || item.content_html != null;

      if (!existing) {
        const created = await this.prisma.scrapedItem.create({
          data: {
            sourceId: source.id,
            sourceLabel: source.name,
            category: resolvedCategory,
            sourceSlug: item.source_slug,
            title: item.title,
            sourceUrl: item.source_url,
            summary: item.summary,
            contentText: item.content_text,
            contentHtml: item.content_html,
            attachmentUrl: item.attachment_url,
            publishedAt: item.published_at ? new Date(item.published_at) : null,
            contentHash,
            aiSummary: item.ai_summary,
            aiSummaryNe: item.ai_summary_ne,
            aiUrgency: item.ai_urgency,
            aiCategoryConfidence: item.ai_category_confidence,
            metadata: item.metadata ? (item.metadata as Prisma.InputJsonValue) : undefined,
            aiAnalyzedAt: item.ai_summary ? new Date() : null,
          },
        });
        itemsNew++;
        if (item.ai_summary) freshlySummarizedIds.push(created.id);

        // Create attachment records
        if (item.attachments?.length) {
          await this.prisma.attachment.createMany({
            data: item.attachments.map((att) => ({
              itemId: created.id,
              url: att.url,
              label: att.label,
              mimeType: att.mime_type,
              sizeBytes: att.size_bytes,
            })),
          });
        }

        // PDF-only notices: extract content via OCR at scrape time
        if (!item.content_text && !item.ai_summary) {
          const pdfUrl = this.findPdfUrl(item.attachment_url, item.attachments);
          if (pdfUrl) {
            const summarized = await this.extractPdfForNotice(created.id, item.title, pdfUrl);
            if (summarized) freshlySummarizedIds.push(created.id);
          }
        }

        // Fallback: if AI service didn't summarize but has text, analyze now
        if (!item.ai_summary && item.content_text) {
          const summarized = await this.analyzeNotice(created.id, item.title, item.content_text);
          if (summarized) freshlySummarizedIds.push(created.id);
        }
      } else if (hasFreshContent && existing.contentHash !== contentHash) {
        await this.prisma.scrapedItem.update({
          where: { id: existing.id },
          data: {
            title: item.title,
            category: resolvedCategory,
            sourceSlug: item.source_slug,
            summary: item.summary,
            contentText: item.content_text ?? existing.contentText,
            contentHtml: item.content_html ?? existing.contentHtml,
            attachmentUrl: item.attachment_url,
            publishedAt: item.published_at ? new Date(item.published_at) : existing.publishedAt,
            contentHash,
            aiSummary: item.ai_summary ?? existing.aiSummary,
            aiSummaryNe: item.ai_summary_ne ?? existing.aiSummaryNe,
            aiUrgency: item.ai_urgency ?? existing.aiUrgency,
            aiCategoryConfidence: item.ai_category_confidence,
            metadata: item.metadata ? (item.metadata as Prisma.InputJsonValue) : undefined,
            aiAnalyzedAt: item.ai_summary ? new Date() : existing.aiAnalyzedAt,
          },
        });
        itemsUpdated++;
        if (item.ai_summary) freshlySummarizedIds.push(existing.id);
        if (item.attachments?.length) {
          await this.prisma.attachment.deleteMany({ where: { itemId: existing.id } });
          await this.prisma.attachment.createMany({
            data: item.attachments.map((att) => ({
              itemId: existing.id,
              url: att.url,
              label: att.label,
              mimeType: att.mime_type,
              sizeBytes: att.size_bytes,
            })),
          });
        }
      } else if (item.attachment_url && existing.attachmentUrl !== item.attachment_url) {
        await this.prisma.scrapedItem.update({
          where: { id: existing.id },
          data: { attachmentUrl: item.attachment_url },
        });
        itemsUpdated++;
      } else {
        itemsSkipped++;
      }
    }

    await this.prisma.scrapeRun.update({
      where: { id: runId },
      data: {
        status: ScrapeRunStatus.SUCCESS,
        itemsFound: items.length,
        itemsNew,
        itemsUpdated,
        itemsSkipped,
        itemsSummarized,
        itemsSummaryFailed,
        finishedAt: new Date(),
      },
    });

    await this.prisma.scrapeSource.update({
      where: { id: source.id },
      data: {
        lastRunAt: new Date(),
        lastStatus: ScrapeRunStatus.SUCCESS,
        ...(schemas.NOTICE ? { noticeSchema: schemas.NOTICE as Prisma.InputJsonValue } : {}),
        ...(schemas.NEWS ? { newsSchema: schemas.NEWS as Prisma.InputJsonValue } : {}),
        ...(schemas.PRESS_RELEASE ? { pressReleaseSchema: schemas.PRESS_RELEASE as Prisma.InputJsonValue } : {}),
      },
    });

    return freshlySummarizedIds;
  }

  /**
   * Send notices with aiSummary to the AI service for vector embedding.
   * Only the items that actually received a fresh summary this run are
   * embedded (they arrive with `aiSummary` from the scrape). This avoids
   * re-embedding the whole corpus on every poll — previously the first
   * arbitrary 200 summarized notices were re-sent each run and nothing
   * beyond them ever made it into the vector store.
   */
  private async embedNewNotices(sourceId: string, ids?: string[]) {
    const notices = await this.prisma.scrapedItem.findMany({
      where: ids?.length
        ? { id: { in: ids } }
        : { sourceId, aiSummary: { not: null } },
      select: {
        id: true,
        title: true,
        aiSummary: true,
        category: true,
        sourceLabel: true,
        sourceUrl: true,
        publishedAt: true,
      },
      take: 200,
    });

    if (!notices.length) return;

    const payload = notices.map((n) => ({
      id: n.id,
      title: n.title,
      ai_summary: n.aiSummary || '',
      category: n.category,
      source_label: n.sourceLabel,
      source_url: n.sourceUrl,
      published_at: n.publishedAt?.toISOString() || null,
    }));

    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/notices/embed`,
          { notices: payload },
          { timeout: 120000 },
        ),
      );
      this.logger.log(`Embedded ${notices.length} notices into vector store`);
    } catch (err: any) {
      this.logger.warn(`Notice embedding request failed: ${err.message}`);
    }
  }

  /** Pre-analyze a notice via the AI service and cache results in the DB. */
  /** Returns true when a summary was persisted (i.e. this notice should be embedded). */
  private async analyzeNotice(id: string, title: string, content: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/notices/analyze`,
          { title, content },
          { timeout: 30000 },
        ),
      );
      if (response.data?.analyzed) {
        await this.prisma.scrapedItem.update({
          where: { id },
          data: {
            aiSummary: response.data.summary,
            keyFacts: response.data.key_facts ?? [],
            tags: response.data.tags ?? [],
            aiAnalyzedAt: new Date(),
          },
        });
        return true;
      }
      await this.prisma.scrapedItem.update({
        where: { id },
        data: { aiAnalyzedAt: new Date() },
      });
      return false;
    } catch (err: any) {
      this.logger.warn(`Pre-analysis failed for notice ${id}: ${err.message}`);
      return false;
    }
  }

  private findPdfUrl(
    attachmentUrl: string | null,
    attachments: RawAttachment[],
  ): string | null {
    const pdfAtt = attachments?.find(
      (a) => a.mime_type?.includes('pdf') || a.url?.toLowerCase().endsWith('.pdf'),
    );
    if (pdfAtt) return pdfAtt.url;
    if (attachmentUrl?.toLowerCase().endsWith('.pdf')) return attachmentUrl;
    if (attachmentUrl?.includes('pdf')) return attachmentUrl;
    return null;
  }

  /** Returns true when a summary was persisted (i.e. this notice should be embedded). */
  private async extractPdfForNotice(id: string, title: string, pdfUrl: string): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/notices/extract-pdf`,
          { url: pdfUrl, title },
          { timeout: 90000 },
        ),
      );
      if (!response.data?.content_text) return false;

      const data: any = {
        contentText: response.data.content_text,
        aiAnalyzedAt: new Date(),
      };
      if (response.data.analyzed) {
        if (response.data.summary) data.aiSummary = response.data.summary;
        if (response.data.summary_ne) data.aiSummaryNe = response.data.summary_ne;
        if (response.data.key_facts) data.keyFacts = response.data.key_facts;
        if (response.data.tags) data.tags = response.data.tags;
      }

      await this.prisma.scrapedItem.update({ where: { id }, data });
      this.logger.log(`PDF extracted and cached for notice ${id}`);
      return Boolean(response.data.summary);
    } catch (err: any) {
      this.logger.warn(`PDF extraction at scrape time failed for ${id}: ${err.message}`);
      return false;
    }
  }

  /** Proxy live status messages from the AI service for a run in progress. */
  async getRunProgress(runId: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/scrape/progress/${runId}`, {
          timeout: 5000,
        }),
      );
      return response.data;
    } catch {
      return { run_id: runId, stage: null, messages: [] };
    }
  }

  // --- Read ---

  async listItems(filters: {
    sourceId?: string;
    category?: 'NOTICE' | 'NEWS';
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    sortBy?: 'publishedAt' | 'scrapedAt' | 'title';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const sortBy = filters.sortBy ?? 'publishedAt';
    const sortOrder = filters.sortOrder ?? 'desc';

    const publishedAtFilter: Prisma.DateTimeFilter = {};
    if (filters.dateFrom) publishedAtFilter.gte = new Date(filters.dateFrom);
    if (filters.dateTo) publishedAtFilter.lte = new Date(filters.dateTo);

    const where: Prisma.ScrapedItemWhereInput = {
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
      ...(filters.category ? { category: filters.category as ScrapedItemCategory } : {}),
      ...(Object.keys(publishedAtFilter).length ? { publishedAt: publishedAtFilter } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search, mode: 'insensitive' } },
              { summary: { contains: filters.search, mode: 'insensitive' } },
              { contentText: { contains: filters.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.scrapedItem.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      this.prisma.scrapedItem.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async deleteItem(id: string) {
    const item = await this.prisma.scrapedItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Scraped item ${id} not found`);
    await this.prisma.scrapedItem.delete({ where: { id } });
    return { deleted: true };
  }

  async updateNotice(id: string, data: { category?: string; tags?: string[]; aiCategoryConfidence?: number }) {
    const item = await this.prisma.scrapedItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Scraped item ${id} not found`);
    const updateData: any = {};
    if (data.category) updateData.category = data.category as any;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.aiCategoryConfidence !== undefined) updateData.aiCategoryConfidence = data.aiCategoryConfidence;
    return this.prisma.scrapedItem.update({
      where: { id },
      data: updateData,
    });
  }

  /** Re-run full AI analysis on an existing notice (contentText required). */
  async reClassifyNotice(id: string) {
    const item = await this.prisma.scrapedItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException(`Scraped item ${id} not found`);
    if (!item.contentText) {
      throw new BadRequestException('Notice has no contentText to re-classify');
    }
    // Delegate to the AI service's analyze endpoint; it will run classification + summary
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.aiServiceUrl}/notices/analyze`,
        { title: item.title, content: item.contentText },
        { timeout: 30000 },
      ),
    );
    if (!response.data?.analyzed) {
      return { reClassified: false, reason: 'AI analysis returned no result' };
    }
    const data: any = {
      aiSummary: response.data.summary,
      aiSummaryNe: response.data.summary_ne ?? null,
      keyFacts: response.data.key_facts ?? [],
      tags: response.data.tags ?? [],
      aiCategoryConfidence: response.data.category_confidence ?? null,
      category: response.data.category ?? undefined,
      aiAnalyzedAt: new Date(),
    };
    await this.prisma.scrapedItem.update({ where: { id }, data });
    return { reClassified: true, ...data };
  }

  async listRuns(filters: {
    sourceId?: string;
    status?: ScrapeRunStatus;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const where: Prisma.ScrapeRunWhereInput = {
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.scrapeRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.scrapeRun.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
