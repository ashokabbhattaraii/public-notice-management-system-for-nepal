import { Injectable, NotFoundException } from '@nestjs/common';
import { ScrapedItemCategory, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicNoticeFilters {
  category?: 'NOTICE' | 'NEWS';
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
  constructor(private readonly prisma: PrismaService) {}

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
    const notice = await this.prisma.scrapedItem.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException(`Notice ${id} not found`);

    // Best-effort view counter — not awaited-critical, so a failure here
    // shouldn't block the read.
    this.prisma.scrapedItem
      .update({ where: { id }, data: { views: { increment: 1 } } })
      .catch(() => undefined);

    return notice;
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
