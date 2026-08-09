import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ScrapedItemCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TtlCache } from '../common/cache/ttl-cache';
import { SingleFlight, SingleFlightCooldownError } from '../common/cache/single-flight';
import { SettingsService } from './settings.service';
import { withTraceAsync } from '../common/logger';
import { buildExcerpt, scoreNotice, tokenizeQuestion } from './notice-search.util';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

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

  // The AI service's primary LLM (DeepSeek) is a reasoning model that can
  // legitimately take 60s+ on a long notice. A 30s budget here meant we
  // abandoned requests the AI service was about to answer successfully —
  // wasting the work and forcing a needless retry later. Sized above the AI
  // service's own DeepSeek read budget (120s) plus its fast fallbacks.
  private readonly aiCallTimeoutMs = Number(process.env.AI_CALL_TIMEOUT_MS ?? 150_000);

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
      const pdfUrl = this.findPdfUrl(notice);
      if (pdfUrl) {
        this.extractPdfAndCache(notice.id, notice.title, pdfUrl)
          .catch((err: any) => {
            if (err instanceof SingleFlightCooldownError) return; // retry later
            this.logger.warn(`PDF extraction failed for notice ${notice.id}: ${err.message}`);
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

  private findPdfUrl(notice: { attachmentUrl: string | null; attachments: { url: string; mimeType: string | null }[] }): string | null {
    // Check attachments table first
    const pdfAtt = notice.attachments?.find(
      (a) => a.mimeType?.includes('pdf') || a.url?.toLowerCase().endsWith('.pdf'),
    );
    if (pdfAtt) return pdfAtt.url;
    // Fall back to legacy attachmentUrl
    if (notice.attachmentUrl?.toLowerCase().endsWith('.pdf')) return notice.attachmentUrl;
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
        this.logger.warn(`PDF extraction failed for notice ${id}: ${err.message}`);
        throw err;
      }
      if (!response.data?.content_text) {
        // Stamp the sentinel anyway so a PDF with genuinely no extractable
        // text (e.g. image-only scan with no OCR output) isn't re-extracted
        // on every single view. Real failures (timeout/5xx) reject above and
        // go through the single-flight backoff instead.
        return this.prisma.scrapedItem.update({
          where: { id },
          data: { aiAnalyzedAt: new Date() },
        });
      }

      const data: any = {
        contentText: response.data.content_text,
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

      return this.prisma.scrapedItem.update({ where: { id }, data });
    });
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
            { timeout: this.aiCallTimeoutMs },
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

  async askQuestion(
    id: string,
    question: string,
    history: ChatTurn[] = [],
  ): Promise<{ answer: string }> {
    const notice = await this.prisma.scrapedItem.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException(`Notice ${id} not found`);

    // Identical questions on the same notice share one LLM call (memoized in
    // qaCache). Fallback/error answers are never cached — only real AI
    // answers, so a transient failure isn't served stale for 5 minutes.
    // History is part of the key: "what about the fee?" means something
    // different after a different preceding turn, so answers cannot be shared
    // across conversations.
    const cacheKey = `qa:${id}:${question}:${this.historyKey(history)}`;
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
            history: this.trimHistory(history),
          },
          { timeout: this.aiCallTimeoutMs },
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
  // "How many X notices are there" is a database aggregate, not a retrieval
  // question — semantic/vector search can only ever return a handful of
  // top-k chunks, so it structurally cannot answer a count accurately (it
  // was returning unrelated notices as if they answered "how many tenders").
  // Detect this intent and answer directly from the real count instead of
  // ever reaching the LLM/vector-search path.
  private static readonly COUNT_INTENT_RE = /\b(how many|number of|count of|total(?:\s+number)?\s+of)\b/i;

  private static readonly CATEGORY_KEYWORDS: Record<string, ScrapedItemCategory> = {
    tender: ScrapedItemCategory.TENDER,
    tenders: ScrapedItemCategory.TENDER,
    // Job/internship openings are all filed under VACANCY (see schema.prisma)
    vacancy: ScrapedItemCategory.VACANCY,
    vacancies: ScrapedItemCategory.VACANCY,
    job: ScrapedItemCategory.VACANCY,
    jobs: ScrapedItemCategory.VACANCY,
    internship: ScrapedItemCategory.VACANCY,
    internships: ScrapedItemCategory.VACANCY,
    circular: ScrapedItemCategory.CIRCULAR,
    circulars: ScrapedItemCategory.CIRCULAR,
    'press release': ScrapedItemCategory.PRESS_RELEASE,
    'press releases': ScrapedItemCategory.PRESS_RELEASE,
    press: ScrapedItemCategory.PRESS_RELEASE,
    news: ScrapedItemCategory.NEWS,
    // Deliberately no 'notice'/'notices' keyword mapping: the word is used
    // site-wide as the generic term for "everything" (page title, nav, etc.)
    // as well as being one specific category among many, so free-text
    // "how many notices are there" should mean the grand total (falls
    // through to the 'ALL' pattern below) — the specific NOTICE category is
    // still reachable via the explicit `category` param (e.g. from a page
    // already filtered to it).
  };

  /** Returns the target category for a count question, 'ALL', or null if this isn't a count question. */
  private detectCountIntent(
    question: string,
    categoryParam?: string,
  ): ScrapedItemCategory | 'ALL' | null {
    if (!NoticesService.COUNT_INTENT_RE.test(question)) return null;

    if (
      categoryParam &&
      (Object.values(ScrapedItemCategory) as string[]).includes(categoryParam)
    ) {
      return categoryParam as ScrapedItemCategory;
    }

    const lower = question.toLowerCase();
    for (const [keyword, cat] of Object.entries(NoticesService.CATEGORY_KEYWORDS)) {
      if (lower.includes(keyword)) return cat;
    }

    if (/\b(notices?|news|items?|documents?|postings?)\b/i.test(question)) return 'ALL';
    return null;
  }

  private formatCategoryLabel(category: ScrapedItemCategory): string {
    return category.toLowerCase().replace(/_/g, ' ');
  }

  /** How many rows the tokenized OR-query pulls before in-process ranking. */
  private static readonly KEYWORD_CANDIDATE_LIMIT = 40;
  /** How many ranked candidates are handed to the AI service for fusion. */
  private static readonly KEYWORD_RESULT_LIMIT = 12;

  /**
   * Tokenized keyword retrieval over notices.
   *
   * Postgres does the cheap, selective part (rows containing *any* content
   * word), and ranking happens in-process where field weighting, phrase
   * bonuses and recency decay are expressible — see `notice-search.util.ts`.
   * Each result carries a query-focused excerpt of the body, so the LLM sees
   * the actual deadline/fee/eligibility text rather than only the summary.
   */
  private async keywordSearch(question: string, category?: string) {
    const parsed = tokenizeQuestion(question);
    const terms = [...parsed.tokens, ...parsed.phrases];

    // Nothing but stopwords ("what about it?") — no lexical signal to search
    // on, so let the vector leg handle it alone rather than returning the
    // newest notices as if they were relevant.
    if (terms.length === 0) return [];

    const rows = await this.prisma.scrapedItem.findMany({
      where: {
        ...(category ? { category: category as ScrapedItemCategory } : {}),
        OR: terms.flatMap((term) => [
          { title: { contains: term, mode: 'insensitive' as const } },
          { aiSummary: { contains: term, mode: 'insensitive' as const } },
          { contentText: { contains: term, mode: 'insensitive' as const } },
        ]),
      },
      select: {
        id: true,
        title: true,
        aiSummary: true,
        summary: true,
        contentText: true,
        category: true,
        sourceLabel: true,
        sourceUrl: true,
        publishedAt: true,
        metadata: true,
      },
      orderBy: { publishedAt: 'desc' },
      take: NoticesService.KEYWORD_CANDIDATE_LIMIT,
    });

    const now = new Date();
    return rows
      .map((row) => ({ row, score: scoreNotice(row, parsed, now) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, NoticesService.KEYWORD_RESULT_LIMIT)
      .map(({ row, score }) => ({
        id: row.id,
        title: row.title,
        aiSummary: row.aiSummary,
        excerpt: buildExcerpt(row.contentText, parsed),
        category: row.category,
        sourceLabel: row.sourceLabel,
        sourceUrl: row.sourceUrl,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        deadline: this.extractDeadline(row.metadata),
        keywordScore: Number(score.toFixed(3)),
      }));
  }

  /**
   * Surface a deadline from the scraper's structured metadata so time-sensitive
   * questions ("is it still open?") can be answered without the model having to
   * find a date buried in the body text.
   */
  private extractDeadline(metadata: Prisma.JsonValue | null): string | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    const record = metadata as Record<string, unknown>;
    for (const key of ['deadline', 'deadlineDate', 'lastDate', 'applicationDeadline']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return null;
  }

  /** Turns kept for follow-up resolution. Beyond this, older context stops
   * helping and starts crowding out the retrieved notices. */
  private static readonly HISTORY_TURNS = 6;
  private static readonly HISTORY_CHARS = 600;

  private trimHistory(history: ChatTurn[] = []): ChatTurn[] {
    return history
      .slice(-NoticesService.HISTORY_TURNS)
      .filter((turn) => turn?.content?.trim())
      .map((turn) => ({
        role: turn.role,
        content: turn.content.trim().slice(0, NoticesService.HISTORY_CHARS),
      }));
  }

  /** Compact history fingerprint for cache keys. */
  private historyKey(history: ChatTurn[] = []): string {
    return this.trimHistory(history)
      .map((turn) => `${turn.role}:${turn.content.slice(0, 80)}`)
      .join('|');
  }

  /**
   * Questions that are unambiguously about the corpus at large rather than the
   * notice the user happens to have open. Everything else defaults to the open
   * notice, which is the sane reading of a question asked while reading one.
   *
   * This replaces a client-side heuristic that ended in `return true` — so
   * "show me other tenders", asked on a notice page, was answered from that
   * single notice.
   */
  private static readonly GENERAL_SCOPE_PATTERNS: RegExp[] = [
    /\b(other|another|different|more)\s+(notice|notices|tender|tenders|vacanc|job|circular|news)/i,
    /^(show|find|list|search|get|browse)\s+(me\s+)?(all|any|other|new|latest|recent)/i,
    /\b(all|any)\s+(notice|notices|tender|tenders|vacanc|jobs?)\b/i,
    /\b(what|anything)('s| is| are)?\s+(new|latest|recent|happening)\b/i,
    /\bhow many\b/i,
    /\b(similar|related)\s+(notice|notices|to this)\b/i,
  ];

  private isGeneralScope(question: string): boolean {
    return NoticesService.GENERAL_SCOPE_PATTERNS.some((pattern) => pattern.test(question));
  }

  /**
   * Phrases the AI service is instructed to use when a notice does not contain
   * the answer. Detecting them lets a notice-scoped miss fall through to a
   * corpus-wide search instead of dead-ending on "this notice doesn't say".
   */
  private static readonly ABSTENTION_PATTERNS: RegExp[] = [
    /does\s?n[o']t\s+(contain|mention|state|specify|say)/i,
    /no\s+(information|mention|details?)\s+(about|on|regarding)/i,
    /not\s+(specified|stated|mentioned|provided)\s+in\s+(this|the)\s+notice/i,
    /उल्लेख छैन|जानकारी छैन/,
  ];

  private looksLikeAbstention(answer: string): boolean {
    return NoticesService.ABSTENTION_PATTERNS.some((pattern) => pattern.test(answer));
  }

  /**
   * Single entry point for the chatbot: decides what kind of question this is
   * and answers accordingly.
   *
   * Routing lives here rather than in the browser because it needs the
   * conversation history, the notice record, and the ability to retry against
   * a different strategy — none of which the client has.
   */
  async chat(input: {
    question: string;
    category?: string;
    language?: string;
    noticeId?: string;
    history?: ChatTurn[];
  }) {
    const question = input.question.trim();
    const history = this.trimHistory(input.history);

    if (input.noticeId && !this.isGeneralScope(question)) {
      const scoped = await this.askQuestion(input.noticeId, question, history);
      // The open notice genuinely doesn't cover it — widen to the whole
      // corpus rather than leaving the user at a dead end.
      if (!this.looksLikeAbstention(scoped.answer)) {
        return { ...scoped, sources: [], scope: 'notice' as const, confidence: 'medium' };
      }
      this.logger.debug('Notice-scoped answer abstained; widening to corpus search');
    }

    const result = await this.search(question, input.category, input.language, history);
    return { ...(result as object), scope: 'general' as const };
  }

  async search(
    question: string,
    category?: string,
    language?: string,
    history: ChatTurn[] = [],
  ) {
    const countTarget = this.detectCountIntent(question, category);
    if (countTarget) return this.countAnswer(countTarget);

    // Identical chatbot queries (same question + filters) share the LLM call
    // within the TTL window — a popular question asked by many visitors
    // doesn't re-hit the AI service (and possibly Qdrant) each time.
    const cacheKey = `search:${question}:${category ?? ''}:${language ?? ''}:${this.historyKey(history)}`;
    const cached = this.qaCache.get(cacheKey);
    if (cached) return cached;

    // Step 1: PostgreSQL keyword retrieval, tokenized and ranked
    const pgResults = await this.keywordSearch(question, category);

    // Step 2: Pass to AI service for hybrid fusion + LLM answer generation
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/notices/search`,
          {
            question,
            pg_results: pgResults,
            category: category || null,
            language: language || 'en',
            top_k: 5,
            history,
          },
          { timeout: this.aiCallTimeoutMs },
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

  /**
   * Streaming counterpart of `chat`, for the SSE endpoint.
   *
   * Returns a description of what to stream rather than the stream itself, so
   * routing stays here (with the DB and the notice record) while the transport
   * details stay in the controller. `answer` is set for the cases resolved
   * without an LLM — counts are exact database aggregates and have nothing to
   * stream.
   */
  async prepareChatStream(input: {
    question: string;
    category?: string;
    language?: string;
    noticeId?: string;
    history?: ChatTurn[];
  }): Promise<
    | { kind: 'immediate'; payload: Record<string, unknown> }
    | { kind: 'stream'; url: string; body: Record<string, unknown>; scope: 'notice' | 'general' }
  > {
    const question = input.question.trim();
    const history = this.trimHistory(input.history);

    const countTarget = this.detectCountIntent(question, input.category);
    if (countTarget) {
      return { kind: 'immediate', payload: await this.countAnswer(countTarget) };
    }

    if (input.noticeId && !this.isGeneralScope(question)) {
      const notice = await this.prisma.scrapedItem.findUnique({
        where: { id: input.noticeId },
        select: { title: true, contentText: true },
      });
      // Only stream from the notice when it actually has text; otherwise fall
      // through to corpus search, which at least has something to work with.
      if (notice?.contentText?.trim()) {
        return {
          kind: 'stream',
          scope: 'notice',
          url: `${this.aiServiceUrl}/notices/ask/stream`,
          body: {
            title: notice.title,
            content: notice.contentText,
            question,
            history,
          },
        };
      }
    }

    return {
      kind: 'stream',
      scope: 'general',
      url: `${this.aiServiceUrl}/notices/search/stream`,
      body: {
        question,
        pg_results: await this.keywordSearch(question, input.category),
        category: input.category || null,
        language: input.language || 'en',
        top_k: 5,
        history,
      },
    };
  }

  /** Exact count from the database — never routed through retrieval, which
   * structurally cannot answer an aggregate from top-k results. */
  private async countAnswer(countTarget: ScrapedItemCategory | 'ALL') {
    const counts = (await this.categoryCounts()) as Record<string, number>;
    const total =
      countTarget === 'ALL'
        ? Object.values(counts).reduce((sum: number, n: number) => sum + Number(n), 0)
        : Number(counts[countTarget] ?? 0);
    const noun = total === 1 ? 'notice' : 'notices';
    const label =
      countTarget === 'ALL' ? noun : `${this.formatCategoryLabel(countTarget)} ${noun}`;
    return {
      answer: `There ${total === 1 ? 'is' : 'are'} currently **${total}** ${label}.`,
      sources: [],
      model_used: null,
      confidence: 'high',
    };
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
