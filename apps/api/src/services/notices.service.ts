import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ScrapedItemCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicNoticeFilters {
  category?: 'NOTICE' | 'NEWS' | 'PRESS_RELEASE';
  sourceId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'publishedAt' | 'views';
  sortOrder?: 'asc' | 'desc';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl = this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
  }

  async findAll(filters: PublicNoticeFilters) {
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const sortBy = filters.sortBy ?? 'publishedAt';
    const sortOrder = filters.sortOrder ?? 'desc';

    const publishedAtFilter: Prisma.DateTimeFilter = {};
    if (filters.dateFrom) publishedAtFilter.gte = new Date(filters.dateFrom);
    if (filters.dateTo) publishedAtFilter.lte = new Date(filters.dateTo);

    const where: Prisma.ScrapedItemWhereInput = {
      ...(filters.category ? { category: filters.category as ScrapedItemCategory } : {}),
      ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
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
        },
      }),
      this.prisma.scrapedItem.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    let notice = await this.prisma.scrapedItem.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException(`Notice ${id} not found`);

    // Best-effort view counter — not awaited-critical, so a failure here
    // shouldn't block the read.
    this.prisma.scrapedItem
      .update({ where: { id }, data: { views: { increment: 1 } } })
      .catch(() => undefined);

    // Lazily compute + cache the AI summary/key facts/tags on first view.
    // Re-analyzed only if the underlying content has since changed
    // (aiAnalyzedAt predates the item's last content update).
    const needsAnalysis =
      notice.contentText &&
      (!notice.aiAnalyzedAt || notice.aiAnalyzedAt < notice.updatedAt);

    if (needsAnalysis) {
      const analyzed = await this.analyzeAndCache(notice.id, notice.title, notice.contentText!);
      if (analyzed) notice = analyzed;
    }

    return notice;
  }

  private async analyzeAndCache(id: string, title: string, content: string) {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/notices/analyze`,
          { title, content },
          { timeout: 30000 },
        ),
      );
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
          keyFacts: response.data.key_facts ?? [],
          tags: response.data.tags ?? [],
          aiAnalyzedAt: new Date(),
        },
      });
    } catch (err: any) {
      this.logger.warn(`Notice analysis failed for ${id}: ${err.message}`);
      return null;
    }
  }

  async askQuestion(id: string, question: string): Promise<{ answer: string }> {
    const notice = await this.prisma.scrapedItem.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException(`Notice ${id} not found`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/notices/ask`,
          { title: notice.title, content: notice.contentText ?? '', question },
          { timeout: 30000 },
        ),
      );
      return { answer: response.data.answer };
    } catch (err: any) {
      this.logger.warn(`Notice Q&A failed for ${id}: ${err.message}`);
      return { answer: 'Sorry, I could not process this question right now — please try again shortly.' };
    }
  }

  async categoryCounts() {
    const counts = await this.prisma.scrapedItem.groupBy({
      by: ['category'],
      _count: { _all: true },
    });
    return Object.fromEntries(counts.map((c) => [c.category, c._count._all]));
  }

  /** Lightweight source list for the public filter dropdown — name/id only. */
  async listSources() {
    return this.prisma.scrapeSource.findMany({
      where: { enabled: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
