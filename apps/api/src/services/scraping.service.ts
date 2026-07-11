import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
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
}

@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);
  private readonly aiServiceUrl: string;
  // Per-source lock: a source can't be scraped twice concurrently, but
  // different sources may run in parallel.
  private readonly runningSourceIds = new Set<string>();

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.aiServiceUrl =
      this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
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
      },
    });
  }

  async updateSource(id: string, input: UpdateScrapeSourceInput) {
    await this.getSource(id);
    const data: Prisma.ScrapeSourceUpdateInput = { ...input };
    // Listing URL changes invalidate any cached extraction schema for that
    // category — the old selectors were derived from the old page.
    if (input.noticeListUrl !== undefined) data.noticeSchema = Prisma.JsonNull;
    if (input.newsListUrl !== undefined) data.newsSchema = Prisma.JsonNull;
    if (input.pressReleaseListUrl !== undefined) data.pressReleaseSchema = Prisma.JsonNull;
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
   */
  async runSource(id: string, categories?: ('NOTICE' | 'NEWS' | 'PRESS_RELEASE')[]) {
    const source = await this.getSource(id);
    if (!source.enabled) {
      throw new ConflictException('This source is disabled');
    }
    if (this.runningSourceIds.has(id)) {
      throw new ConflictException('A scrape run is already in progress for this source');
    }
    this.runningSourceIds.add(id);

    const run = await this.prisma.scrapeRun.create({
      data: { sourceId: id, sourceLabel: source.name, status: ScrapeRunStatus.RUNNING },
    });

    this.executeRun(run.id, source, categories).catch((err: any) => {
      this.logger.error(`Unhandled error in scrape run ${run.id}: ${err.message}`);
    });

    return { runId: run.id };
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

      const validCategories = new Set([
        'NOTICE', 'NEWS', 'PRESS_RELEASE', 'CIRCULAR', 'TENDER', 'VACANCY', 'OTHER',
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
              await this.extractPdfForNotice(created.id, item.title, pdfUrl);
            }
          }

          // Fallback: if AI service didn't summarize but has text, analyze now
          if (!item.ai_summary && item.content_text) {
            await this.analyzeNotice(created.id, item.title, item.content_text);
          }
        } else if (existing.contentHash !== contentHash) {
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

          // Upsert attachments on content change
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

      // Embed newly summarized notices into vector store (fire-and-forget)
      this.embedNewNotices(source.id).catch((err: any) => {
        this.logger.warn(`Background embedding failed: ${err.message}`);
      });
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
    } finally {
      this.runningSourceIds.delete(source.id);
    }
  }

  /** Send notices with aiSummary to the AI service for vector embedding. */
  private async embedNewNotices(sourceId: string) {
    const notices = await this.prisma.scrapedItem.findMany({
      where: { sourceId, aiSummary: { not: null } },
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
  private async analyzeNotice(id: string, title: string, content: string) {
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
      } else {
        await this.prisma.scrapedItem.update({
          where: { id },
          data: { aiAnalyzedAt: new Date() },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Pre-analysis failed for notice ${id}: ${err.message}`);
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

  private async extractPdfForNotice(id: string, title: string, pdfUrl: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/notices/extract-pdf`,
          { url: pdfUrl, title },
          { timeout: 90000 },
        ),
      );
      if (!response.data?.content_text) return;

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
    } catch (err: any) {
      this.logger.warn(`PDF extraction at scrape time failed for ${id}: ${err.message}`);
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

  async listRuns(sourceId?: string, limit = 20) {
    return this.prisma.scrapeRun.findMany({
      where: sourceId ? { sourceId } : undefined,
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
  }
}
