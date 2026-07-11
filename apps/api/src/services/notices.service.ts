import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { ScrapedItemCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicNoticeFilters {
  category?: string;
  sourceId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  urgency?: string;
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
  }

  async findOne(id: string) {
    let notice = await this.prisma.scrapedItem.findUnique({
      where: { id },
      include: { attachments: true },
    });
    if (!notice) throw new NotFoundException(`Notice ${id} not found`);

    this.prisma.scrapedItem
      .update({ where: { id }, data: { views: { increment: 1 } } })
      .catch(() => undefined);

    // If no content text but has a PDF attachment, trigger extraction in the
    // background (for legacy notices scraped before PDF extraction was added to
    // the pipeline). The page loads immediately; frontend polls for updated data.
    if (!notice.contentText) {
      const pdfUrl = this.findPdfUrl(notice);
      if (pdfUrl) {
        this.extractPdfAndCache(notice.id, notice.title, pdfUrl).catch(() => {});
      }
    }

    const needsAnalysis =
      notice.contentText &&
      (!notice.aiAnalyzedAt || notice.aiAnalyzedAt < notice.updatedAt);

    if (needsAnalysis) {
      const analyzed = await this.analyzeAndCache(notice.id, notice.title, notice.contentText!);
      if (analyzed) {
        return { ...analyzed, attachments: notice.attachments };
      }
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
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.aiServiceUrl}/notices/extract-pdf`,
          { url: pdfUrl, title },
          { timeout: 90000 },
        ),
      );
      if (!response.data?.content_text) return null;

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

      return this.prisma.scrapedItem.update({ where: { id }, data });
    } catch (err: any) {
      this.logger.warn(`PDF extraction failed for notice ${id}: ${err.message}`);
      return null;
    }
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
          aiSummaryNe: response.data.summary_ne ?? null,
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

  /**
   * Hybrid notice search for the floating chatbot:
   * 1. PostgreSQL keyword search (fast, free)
   * 2. Pass results to AI service which uses them or falls back to Qdrant semantic search
   * 3. LLM generates an answer from the retrieved context
   */
  async search(question: string, category?: string, language?: string) {
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
