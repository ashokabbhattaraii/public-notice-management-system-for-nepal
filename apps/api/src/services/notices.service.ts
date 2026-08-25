import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ScrapedItemCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TtlCache } from '../common/cache/ttl-cache';
import { SingleFlight, SingleFlightCooldownError } from '../common/cache/single-flight';
import { SettingsService } from './settings.service';
import { withTraceAsync } from '../common/logger';

export interface PublicNoticeFilters {
  category?: string;
  sourceId?: string;
  search?: string;
  tag?: string;
  dateFrom?: string;
  dateTo?: string;
  urgency?: string;
  sortBy?: "publishedAt" | "views";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
}

// Public read layer over the scraping pipeline's data — no auth, no admin
// fields (schemas, run history, etc.). Kept separate from ScrapingService,
// which owns admin CRUD/trigger/detection concerns.
@Injectable()
export class NoticesService {
  private readonly logger = new Logger(NoticesService.name);
  private readonly aiServiceUrl: string;

  // Hot public read paths are cheap to recompute and change slowly, so serve
  // them from a single-flight TTL cache instead of hitting Postgres on every
  // page load.
  private readonly listCache = new TtlCache<unknown>(
    Number(process.env.NOTICES_LIST_CACHE_MS ?? 10_000),
  );
  private readonly metaCache = new TtlCache<unknown>(
    Number(process.env.NOTICES_META_CACHE_MS ?? 60_000),
  );

  // Single-flight guard around view-triggered AI enrichment (PDF OCR, LLM
  // summarization). Without it, N users opening the same unanalyzed notice
  // fire N identical AI calls in the same window. Failure backoff (default
  // 60s) additionally stops a flaky AI service from being retried by every
  // viewer at once.
  private readonly aiSingleFlight = new SingleFlight(
    Number(process.env.AI_RETRY_COOLDOWN_MS ?? 60_000),
  );

  // Cheap answer memo for the notice Q&A + global chatbot: identical
  // questions (same notice, same prompt) share the LLM call, so a popular
  // question asked by many users isn't re-generated each time.
  private readonly qaCache = new TtlCache<unknown>(Number(process.env.QA_CACHE_MS ?? 5 * 60_000));

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly settings: SettingsService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
  }

  async findAll(filters: PublicNoticeFilters) {
    const page = filters.page ?? 1;
    const defaultLimit = await this.settings.getNumber('notices.perPage', 20);
    const limit = Math.min(filters.limit ?? defaultLimit, 100);
    const sortBy = filters.sortBy ?? 'publishedAt';
    const sortOrder = filters.sortOrder ?? 'desc';

    const cacheKey = `list:${JSON.stringify({ ...filters, page, limit })}`;
    return this.listCache.remember(cacheKey, async () => {
      const publishedAtFilter: Prisma.DateTimeFilter = {};
      if (filters.dateFrom) publishedAtFilter.gte = new Date(filters.dateFrom);
      if (filters.dateTo) publishedAtFilter.lte = new Date(filters.dateTo);

      const where: Prisma.ScrapedItemWhereInput = {
        ...(filters.category ? { category: filters.category as ScrapedItemCategory } : {}),
        ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
        ...(filters.urgency ? { aiUrgency: filters.urgency } : {}),
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
        ...(filters.tag
          ? {
              tags: {
                array_contains: filters.tag,
              },
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
          select: {
            id: true,
            sourceId: true,
            sourceLabel: true,
            category: true,
            title: true,
            sourceUrl: true,
            summary: true,
            attachmentUrl: true,
            publishedAt: true,
            scrapedAt: true,
            views: true,
            aiSummary: true,
            aiSummaryNe: true,
            aiUrgency: true,
          },
        }),
        this.prisma.scrapedItem.count({ where }),
      ]);

      return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    });
  }

  async findOne(id: string) {
    const notice = await this.prisma.scrapedItem.findUnique({
      where: { id },
      include: { attachments: true },
    });
    if (!notice) throw new NotFoundException(`Notice ${id} not found`);

    this.prisma.scrapedItem
      .update({ where: { id }, data: { views: { increment: 1 } } })
      .catch(() => undefined);

    // PDF-only notice: contentText comes from OCR, so trigger extraction in
    // the background (legacy notices scraped before extraction was added to
    // the pipeline). The page loads immediately; the frontend polls for
    // updated data. Single-flight ensures N concurrent viewers trigger ONE
    // extraction, and `pdfExtractAt` stamps a completion sentinel so a
    // successful notice isn't re-extracted on every subsequent view either.
    if (!notice.contentText && !notice.aiAnalyzedAt) {
      const attachmentUrl = this.findExtractableAttachmentUrl(notice);
      if (attachmentUrl) {
        this.extractPdfAndCache(notice.id, notice.title, attachmentUrl)
          .catch((err: any) => {
            if (err instanceof SingleFlightCooldownError) return; // retry later
            this.logger.warn(`Attachment extraction failed for notice ${notice.id}: ${err.message}`);
          });
      }
    }

    const needsAnalysis =
      notice.contentText &&
      (!notice.aiAnalyzedAt || notice.aiAnalyzedAt < notice.updatedAt);

    // Run the AI enrichment in the background (it can take up to 30s) and
    // return the cached row immediately — the frontend polls for updated data,
    // exactly like the PDF-extraction path below. Keeps first-paint fast.
    if (needsAnalysis) {
      void withTraceAsync(() =>
        this.analyzeAndCache(notice.id, notice.title, notice.contentText!)
          .then((analyzed) => {
            if (analyzed) this.logger.debug(`Notice ${notice.id} analyzed and cached`);
          })
          .catch((err: any) => {
            if (err instanceof SingleFlightCooldownError) return; // another run in cooldown
            this.logger.warn(`Notice analysis failed for ${notice.id}: ${err.message}`);
          }),
      );
    }

    return notice;
  }

  /**
   * Attachment list for the Q&A context, including the legacy single
   * `attachmentUrl` column when it isn't already represented in the
   * attachments table.
   */
  private attachmentContext(notice: {
    attachmentUrl: string | null;
    attachments: { url: string; label: string | null; mimeType: string | null; sizeBytes: number | null }[];
  }): { name: string; url: string; mime_type: string | null; size_bytes: number | null }[] {
    const nameOf = (url: string, label: string | null) =>
      label?.trim() || decodeURIComponent(url.split('/').pop()?.split('?')[0] ?? url);

    const list = notice.attachments.map((a) => ({
      name: nameOf(a.url, a.label),
      url: a.url,
      mime_type: a.mimeType,
      size_bytes: a.sizeBytes,
    }));

    if (notice.attachmentUrl && !list.some((a) => a.url === notice.attachmentUrl)) {
      list.push({
        name: nameOf(notice.attachmentUrl, null),
        url: notice.attachmentUrl,
        mime_type: null,
        size_bytes: null,
      });
    }
    return list;
  }

  // Scanned notices are just as often a photographed/screenshotted image
  // (JPG, PNG) as a PDF — both are OCR-able via the same AI service route,
  // so both count as "extractable" here.
  private static readonly IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff'];

  private isExtractableUrl(url: string | null | undefined, mimeType?: string | null): boolean {
    if (!url) return false;
    const lower = url.toLowerCase().split('?')[0].split('#')[0];
    if (mimeType?.includes('pdf') || lower.endsWith('.pdf')) return true;
    if (mimeType?.startsWith('image/')) return true;
    return NoticesService.IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
  }

  private findExtractableAttachmentUrl(notice: { attachmentUrl: string | null; attachments: { url: string; mimeType: string | null }[] }): string | null {
    // Check attachments table first
    const match = notice.attachments?.find((a) => this.isExtractableUrl(a.url, a.mimeType));
    if (match) return match.url;
    // Fall back to legacy attachmentUrl
    if (this.isExtractableUrl(notice.attachmentUrl)) return notice.attachmentUrl;
    if (notice.attachmentUrl?.includes('pdf')) return notice.attachmentUrl;
    return null;
  }

  private async extractPdfAndCache(id: string, title: string, pdfUrl: string) {
    // Single-flight per notice: N concurrent viewers share one in-flight OCR
    // run, and a failure rejection triggers the single-flight backoff so the
    // AI service isn't pounded by every viewer retrying at once. Note: errors
    // are logged then re-thrown so the backoff kicks in (callers `.catch()`).
    return this.aiSingleFlight.run(`pdf:${id}`, async () => {
      let response;
      try {
        response = await firstValueFrom(
          this.httpService.post(
            `${this.aiServiceUrl}/notices/extract-pdf`,
            { url: pdfUrl, title },
            { timeout: 90000 },
          ),
        );
      } catch (err: any) {
        // axios reduces an upstream 4xx to "Request failed with status code
        // 400", which says nothing. The AI service puts the actual reason
        // (bad URL, not a PDF, download blocked) in the response body.
        const upstream = err.response?.data?.error;
        if (upstream) err.message = upstream;
        this.logger.warn(`PDF extraction failed for notice ${id}: ${err.message}`);
        throw err;
      }
      const meta = {
        chars: String(response.data?.content_text ?? '').length,
        quality: typeof response.data?.quality === 'number' ? response.data.quality : null,
        method: response.data?.method ?? null,
        isOcr: Boolean(response.data?.is_ocr),
      };

      if (!response.data?.content_text) {
        // Stamp the sentinel anyway so a PDF with genuinely no extractable
        // text (e.g. image-only scan with no OCR output) isn't re-extracted
        // on every single view. Real failures (timeout/5xx) reject above and
        // go through the single-flight backoff instead.
        await this.prisma.scrapedItem.update({
          where: { id },
          data: { aiAnalyzedAt: new Date() },
        });
        return meta;
      }

      // Legacy Nepali fonts (Preeti and friends) decode to confident-looking
      // symbol noise — `S Ñ ! ."$% &'( )*(` — which is worse than no text:
      // it renders as garbage on the notice page, pollutes the RAG index, and
      // gets echoed back as chatbot "answers". The AI summary is still kept
      // (the LLM reads the rendered pages, so it stays usable); only the body
      // text is withheld.
      const usableText =
        meta.quality === null || meta.quality >= NoticesService.EXTRACTION_QUALITY_FLOOR;
      if (!usableText) {
        this.logger.warn(
          `Discarding unreadable extracted text for notice ${id} ` +
            `(quality ${meta.quality} < ${NoticesService.EXTRACTION_QUALITY_FLOOR}, method=${meta.method ?? 'unknown'})`,
        );
      }

      const data: any = {
        ...(usableText ? { contentText: response.data.content_text } : {}),
        aiAnalyzedAt: new Date(),
      };
      if (response.data.analyzed) {
        if (response.data.summary) data.aiSummary = response.data.summary;
        if (response.data.summary_ne) data.aiSummaryNe = response.data.summary_ne;
        if (response.data.key_facts) data.keyFacts = response.data.key_facts;
        if (response.data.tags) data.tags = response.data.tags;
        if (response.data.category) data.category = response.data.category;
        if (response.data.category_confidence !== undefined) data.aiCategoryConfidence = response.data.category_confidence;
      }

      await this.prisma.scrapedItem.update({ where: { id }, data });
      this.logger.log(
        `Extracted notice ${id}: ${meta.chars} chars, quality=${meta.quality ?? 'n/a'}, method=${meta.method ?? 'n/a'}`,
      );
      return meta;
    });
  }

  /**
   * Rough mirror of the AI service's `_text_quality` scorer, used only to pick
   * re-extraction candidates without shipping every notice's text over HTTP.
   * Devanagari share decides it outright; otherwise English function-word
   * density separates prose from legacy-font noise ("BXXYRCO ; WREVERE …").
   */
  private textQuality(text: string | null): number {
    if (!text || text.trim().length < 40) return 0;
    const sample = text.slice(0, 8000);
    const nonSpace = sample.replace(/\s/g, '');
    if (!nonSpace) return 0;

    const devanagari = (nonSpace.match(/[ऀ-ॿ]/g) ?? []).length / nonSpace.length;
    if (devanagari >= 0.15) return Math.min(1, 0.65 + devanagari);

    const tokens = (sample.toLowerCase().match(/[a-z]{2,}/g) ?? []);
    if (tokens.length < 25) return 0.6;
    const hits = tokens.filter((t) => NoticesService.EN_STOPWORDS.has(t)).length;
    return Math.max(Math.min(1, hits / tokens.length / 0.12), Math.min(0.6, devanagari * 4));
  }

  /**
   * Minimum quality score (0-1) for extracted PDF text to be stored as a
   * notice's body. Mirrors the AI service's extractor.QUALITY_THRESHOLD —
   * below this the "text" is legacy-font/OCR noise rather than language.
   */
  private static readonly EXTRACTION_QUALITY_FLOOR = 0.55;

  private static readonly EN_STOPWORDS = new Set(
    ('the of and to in for is on by with as at from this that shall be will has have are was were ' +
      'it its or an a not all may must which their there been such under within after before date ' +
      'notice office ministry government nepal department').split(' '),
  );

  /** Quality score of a notice's stored text — surfaced so admins can see why. */
  contentQuality(text: string | null): number {
    return Math.round(this.textQuality(text) * 100) / 100;
  }

  /**
   * Admin action: re-run attachment extraction for one notice, overwriting the
   * stored text. Bypasses both the "already analyzed" sentinel and the
   * single-flight failure cooldown — this is a deliberate retry, not the
   * opportunistic background pass triggered by a page view.
   */
  async reextract(id: string) {
    const notice = await this.prisma.scrapedItem.findUnique({
      where: { id },
      include: { attachments: { select: { url: true, mimeType: true } } },
    });
    if (!notice) throw new NotFoundException(`Notice ${id} not found`);

    const attachmentUrl = this.findExtractableAttachmentUrl(notice);
    if (!attachmentUrl) {
      return {
        id,
        updated: false,
        reason: 'This notice has no PDF or image attachment to extract text from.',
      };
    }

    this.aiSingleFlight.reset(`pdf:${id}`);
    const before = this.contentQuality(notice.contentText);

    try {
      const meta = await this.extractPdfAndCache(id, notice.title, attachmentUrl);
      const fresh = await this.prisma.scrapedItem.findUnique({
        where: { id },
        select: { contentText: true },
      });
      const after = this.contentQuality(fresh?.contentText ?? null);

      // The stored text changed, so any memoized answer about it is stale.
      this.qaCache.clear();
      this.listCache.clear();

      return {
        id,
        updated: meta.chars > 0,
        chars: meta.chars,
        isOcr: meta.isOcr,
        method: meta.method,
        qualityBefore: before,
        qualityAfter: after,
        reason:
          meta.chars > 0
            ? undefined
            : 'Extraction produced no text — the attachment may be unreadable.',
      };
    } catch (err: any) {
      if (err instanceof SingleFlightCooldownError) {
        throw new ServiceUnavailableException('An extraction for this notice is already running.');
      }
      this.logger.warn(`Admin re-extract failed for ${id}: ${err.message}`);
      throw new ServiceUnavailableException(`Extraction failed: ${err.message}`);
    }
  }

  /**
   * Admin action: re-extract many notices in the background.
   *
   * `scope: 'garbled'` (default) only touches notices whose stored text scores
   * below the quality bar — the ones showing noise today. `'all'` re-runs every
   * notice that has an attachment. Runs with a small concurrency so the AI
   * service (OCR is CPU-heavy) isn't swamped, and returns immediately.
   */
  async reextractBulk(scope: 'garbled' | 'all' = 'garbled', limit = 200) {
    const cappedLimit = Math.min(Math.max(1, limit), 1000);
    const candidates = await this.prisma.scrapedItem.findMany({
      where: { OR: [{ attachments: { some: {} } }, { attachmentUrl: { not: null } }] },
      select: { id: true, title: true, contentText: true },
      orderBy: { scrapedAt: 'desc' },
      take: cappedLimit,
    });

    const selected =
      scope === 'all'
        ? candidates
        : candidates.filter((n) => this.textQuality(n.contentText) < 0.55);

    void this.runBulkReextract(selected.map((n) => n.id));

    return {
      scope,
      scanned: candidates.length,
      queued: selected.length,
      message:
        selected.length > 0
          ? `Re-extracting ${selected.length} notice(s) in the background. Refresh in a few minutes.`
          : 'No notices need re-extraction.',
    };
  }

  /** Background worker for `reextractBulk` — bounded concurrency, never throws. */
  private async runBulkReextract(ids: string[], concurrency = 2) {
    let done = 0;
    let improved = 0;

    const worker = async () => {
      for (;;) {
        const id = ids[done++];
        if (id === undefined) return;
        try {
          const result = await this.reextract(id);
          if (result.updated && (result.qualityAfter ?? 0) > (result.qualityBefore ?? 0)) {
            improved++;
          }
        } catch (err: any) {
          this.logger.warn(`Bulk re-extract failed for ${id}: ${err.message}`);
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
    if (ids.length > 0) {
      this.logger.log(`Bulk re-extract finished: ${ids.length} processed, ${improved} improved`);
    }
  }

  private async analyzeAndCache(id: string, title: string, content: string) {
    // Single-flight per notice: N concurrent viewers opening the same
    // unanalyzed notice share ONE summarization call. Errors are re-thrown so
    // the single-flight backoff applies (callers `.catch()`).
    return this.aiSingleFlight.run(`analyze:${id}`, async () => {
      let response;
      try {
        response = await firstValueFrom(
          this.httpService.post(
            `${this.aiServiceUrl}/notices/analyze`,
            { title, content },
            { timeout: 30000 },
          ),
        );
      } catch (err: any) {
        this.logger.warn(`Notice analysis failed for ${id}: ${err.message}`);
        throw err;
      }
      if (!response.data?.analyzed) {
        // Still stamp aiAnalyzedAt so we don't retry every single view when
        // there's genuinely nothing to summarize (e.g. no LLM configured).
        return this.prisma.scrapedItem.update({
          where: { id },
          data: { aiAnalyzedAt: new Date() },
        });
      }
      return this.prisma.scrapedItem.update({
        where: { id },
        data: {
          aiSummary: response.data.summary,
          aiSummaryNe: response.data.summary_ne ?? null,
          keyFacts: response.data.key_facts ?? [],
          tags: response.data.tags ?? [],
          aiCategoryConfidence: response.data.category_confidence ?? null,
          category: response.data.category ?? undefined,
          aiAnalyzedAt: new Date(),
        },
      });
    });
  }

  async askQuestion(id: string, question: string): Promise<{ answer: string }> {
    const notice = await this.prisma.scrapedItem.findUnique({
      where: { id },
      include: {
        attachments: {
          select: { url: true, label: true, mimeType: true, sizeBytes: true },
        },
      },
    });
    if (!notice) throw new NotFoundException(`Notice ${id} not found`);

    // Identical questions on the same notice share one LLM call (memoized in
    // qaCache). Fallback/error answers are never cached — only real AI
    // answers, so a transient failure isn't served stale for 5 minutes.
    const cacheKey = `qa:${id}:${question}`;
    const cached = this.qaCache.get(cacheKey);
    if (cached) return cached as { answer: string };

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/notices/ask`,
          {
            title: notice.title,
            content: notice.contentText ?? '',
            question,
            // Everything the notice page itself shows. Sending only
            // contentText meant the model couldn't answer "is there a PDF?"
            // (it never saw the attachments) and had nothing to fall back on
            // when a scanned/legacy-font PDF extracts as garbled text.
            summary: notice.aiSummary ?? notice.summary ?? '',
            summary_ne: notice.aiSummaryNe ?? '',
            key_facts: Array.isArray(notice.keyFacts) ? notice.keyFacts : [],
            metadata:
              notice.metadata && typeof notice.metadata === 'object' ? notice.metadata : {},
            category: notice.category,
            source_label: notice.sourceLabel,
            source_url: notice.sourceUrl,
            published_at: notice.publishedAt?.toISOString() ?? null,
            attachments: this.attachmentContext(notice),
          },
          { timeout: 30000 },
        ),
      );
      const answer = { answer: String(response.data?.answer ?? '') };
      this.qaCache.set(cacheKey, answer);
      return answer;
    } catch (err: any) {
      this.logger.warn(`Notice Q&A failed for ${id}: ${err.message}`);
      return { answer: 'Sorry, I could not process this question right now — please try again shortly.' };
    }
  }

  /**
   * Hybrid notice search for the floating chatbot:
   * 1. PostgreSQL keyword search (fast, free)
   * 2. Pass results to AI service which uses them or falls back to Qdrant semantic search
   * 3. LLM generates an answer from the retrieved context
   */
  async search(question: string, category?: string, language?: string) {
    // Identical chatbot queries (same question + filters) share the LLM call
    // within the TTL window — a popular question asked by many visitors
    // doesn't re-hit the AI service (and possibly Qdrant) each time.
    const cacheKey = `search:${question}:${category ?? ''}:${language ?? ''}`;
    const cached = this.qaCache.get(cacheKey);
    if (cached) return cached;

    // Step 1: PostgreSQL keyword search via ILIKE (simple but effective for keyword queries)
    const pgResults = await this.prisma.scrapedItem.findMany({
      where: {
        ...(category ? { category: category as ScrapedItemCategory } : {}),
        OR: [
          { title: { contains: question, mode: 'insensitive' } },
          { aiSummary: { contains: question, mode: 'insensitive' } },
          { contentText: { contains: question, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        title: true,
        aiSummary: true,
        category: true,
        sourceLabel: true,
        sourceUrl: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: 10,
    });

    // Step 2: Pass to AI service for hybrid search + LLM answer generation
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/notices/search`,
          {
            question,
            pg_results: pgResults.map((r) => ({
              id: r.id,
              title: r.title,
              aiSummary: r.aiSummary,
              category: r.category,
              sourceLabel: r.sourceLabel,
              sourceUrl: r.sourceUrl,
              publishedAt: r.publishedAt?.toISOString() || null,
            })),
            category: category || null,
            language: language || 'en',
            top_k: 5,
          },
{ timeout: 45000 },
        ),
      );
      this.qaCache.set(cacheKey, response.data);
      return response.data;
    } catch (err: any) {
      this.logger.warn(`Notice search failed: ${err.message}`);
      // If AI service is down, return a basic response from PG results
      if (pgResults.length > 0) {
        return {
          answer: `I found ${pgResults.length} relevant notice(s). Here are the top results:\n\n` +
            pgResults.slice(0, 3).map((r, i) =>
              `${i + 1}. **${r.title}**${r.aiSummary ? ` — ${r.aiSummary.slice(0, 150)}...` : ''}`
            ).join('\n\n'),
          sources: pgResults.slice(0, 5).map((r) => ({
            id: r.id,
            title: r.title,
            category: r.category,
            sourceUrl: r.sourceUrl,
          })),
          model_used: null,
        };
      }
      return {
        answer: 'Sorry, I could not process your search right now. Please try again shortly.',
        sources: [],
        model_used: null,
      };
    }
  }

  async categoryCounts() {
    return this.metaCache.remember('category-counts', async () => {
      const counts = await this.prisma.scrapedItem.groupBy({
        by: ['category'],
        _count: { _all: true },
      });
      return Object.fromEntries(counts.map((c) => [c.category, c._count._all]));
    });
  }

  /** Lightweight source list for the public filter dropdown — name/id only. */
  async listSources() {
    return this.metaCache.remember('sources', async () => {
      return this.prisma.scrapeSource.findMany({
        where: { enabled: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    });
  }
}
