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

interface RawScrapedItem {
  category: 'NOTICE' | 'NEWS';
  title: string;
  source_url: string;
  published_at: string | null;
  summary: string | null;
  content_text: string | null;
  content_html: string | null;
  attachment_url: string | null;
}

export interface CreateScrapeSourceInput {
  name: string;
  baseUrl: string;
  noticeListUrl?: string | null;
  newsListUrl?: string | null;
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
    if (!input.noticeListUrl && !input.newsListUrl) {
      throw new ConflictException(
        'At least one of noticeListUrl or newsListUrl is required',
      );
    }
    return this.prisma.scrapeSource.create({
      data: {
        name: input.name,
        baseUrl: input.baseUrl,
        noticeListUrl: input.noticeListUrl || null,
        newsListUrl: input.newsListUrl || null,
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
  async runSource(id: string, categories?: ('NOTICE' | 'NEWS')[]) {
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
    categories?: ('NOTICE' | 'NEWS')[],
  ) {
    try {
      const categoryUrls: Record<string, string> = {};
      const wantedCategories = categories ?? ['NOTICE', 'NEWS'];
      if (wantedCategories.includes('NOTICE') && source.noticeListUrl) {
        categoryUrls.NOTICE = source.noticeListUrl;
      }
      if (wantedCategories.includes('NEWS') && source.newsListUrl) {
        categoryUrls.NEWS = source.newsListUrl;
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

      let itemsNew = 0;
      let itemsUpdated = 0;

      for (const item of items) {
        const contentHash = crypto
          .createHash('sha256')
          .update(`${item.title}|${item.content_text ?? ''}`)
          .digest('hex');

        const existing = await this.prisma.scrapedItem.findUnique({
          where: { sourceUrl: item.source_url },
        });

        if (!existing) {
          await this.prisma.scrapedItem.create({
            data: {
              sourceId: source.id,
              sourceLabel: source.name,
              category: item.category as ScrapedItemCategory,
              title: item.title,
              sourceUrl: item.source_url,
              summary: item.summary,
              contentText: item.content_text,
              contentHtml: item.content_html,
              attachmentUrl: item.attachment_url,
              publishedAt: item.published_at ? new Date(item.published_at) : null,
              contentHash,
            },
          });
          itemsNew++;
        } else if (existing.contentHash !== contentHash) {
          await this.prisma.scrapedItem.update({
            where: { id: existing.id },
            data: {
              title: item.title,
              summary: item.summary,
              contentText: item.content_text ?? existing.contentText,
              contentHtml: item.content_html ?? existing.contentHtml,
              attachmentUrl: item.attachment_url,
              publishedAt: item.published_at ? new Date(item.published_at) : existing.publishedAt,
              contentHash,
            },
          });
          itemsUpdated++;
        } else if (item.attachment_url && existing.attachmentUrl !== item.attachment_url) {
          // Content is unchanged (hash match) but a newly-detected schema now
          // captures an attachment this item didn't have before — sync it
          // without touching the rest of the record.
          await this.prisma.scrapedItem.update({
            where: { id: existing.id },
            data: { attachmentUrl: item.attachment_url },
          });
          itemsUpdated++;
        }
      }

      await this.prisma.scrapeRun.update({
        where: { id: runId },
        data: {
          status: ScrapeRunStatus.SUCCESS,
          itemsFound: items.length,
          itemsNew,
          itemsUpdated,
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
        },
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
