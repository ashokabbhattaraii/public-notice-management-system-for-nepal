import { Injectable, Logger } from '@nestjs/common';
import { UsageMetric } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface UsageSnapshot {
  aiQuestions: number;
  documentUploads: number;
  whatsappNotifications: number;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Monthly usage metering.
 *
 * Two stores, on purpose: `UsageCounter` is a single row per user/metric/month
 * that quota checks read and increment atomically, and `UsageEvent` is the
 * append-only detail the admin drill-down reads. Counting by scanning events
 * would put a growing aggregate on the hot path of every metered request.
 */
@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** First instant of the current UTC month — the counter's bucket key. */
  static periodStart(at: Date = new Date()): Date {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  }

  static periodEnd(at: Date = new Date()): Date {
    return new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  }

  async currentCount(userId: string, metric: UsageMetric): Promise<number> {
    const counter = await this.prisma.usageCounter.findUnique({
      where: {
        userId_metric_periodStart: {
          userId,
          metric,
          periodStart: UsageService.periodStart(),
        },
      },
      select: { count: true },
    });
    return counter?.count ?? 0;
  }

  /**
   * Record usage and return the new total.
   *
   * The upsert's `increment` is what makes this safe under concurrency — two
   * simultaneous requests can't both read 9 and write 10.
   */
  async record(
    userId: string,
    metric: UsageMetric,
    quantity = 1,
    metadata?: Record<string, unknown>,
  ): Promise<number> {
    const periodStart = UsageService.periodStart();

    const [counter] = await this.prisma.$transaction([
      this.prisma.usageCounter.upsert({
        where: { userId_metric_periodStart: { userId, metric, periodStart } },
        create: { userId, metric, periodStart, count: quantity },
        update: { count: { increment: quantity } },
        select: { count: true },
      }),
      this.prisma.usageEvent.create({
        data: {
          userId,
          metric,
          quantity,
          metadata: metadata ? (metadata as never) : undefined,
        },
        select: { id: true },
      }),
    ]);

    return counter.count;
  }

  /** Everything the billing panel shows for one user, in one round-trip. */
  async snapshotFor(userId: string): Promise<UsageSnapshot> {
    const periodStart = UsageService.periodStart();
    const counters = await this.prisma.usageCounter.findMany({
      where: { userId, periodStart },
      select: { metric: true, count: true },
    });

    const of = (metric: UsageMetric) =>
      counters.find((c) => c.metric === metric)?.count ?? 0;

    return {
      aiQuestions: of(UsageMetric.AI_QUESTION),
      documentUploads: of(UsageMetric.DOCUMENT_UPLOAD),
      whatsappNotifications: of(UsageMetric.WHATSAPP_NOTIFICATION),
      periodStart,
      periodEnd: UsageService.periodEnd(),
    };
  }

  /** Admin drill-down: recent metered activity for one user. */
  async recentEvents(userId: string, limit = 100) {
    return this.prisma.usageEvent.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(1, limit), 500),
      select: { id: true, metric: true, quantity: true, metadata: true, createdAt: true },
    });
  }

  /**
   * Usage across all users for the current month, joined with each user's
   * plan — the admin overview table.
   */
  async monthlyOverview(limit = 100, offset = 0) {
    const periodStart = UsageService.periodStart();

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: offset,
        take: Math.min(Math.max(1, limit), 200),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          createdAt: true,
          subscription: {
            select: {
              status: true,
              cancelAtPeriodEnd: true,
              currentPeriodEnd: true,
              grantedByAdmin: true,
              plan: { select: { tier: true, name: true } },
            },
          },
          usageCounters: {
            where: { periodStart },
            select: { metric: true, count: true },
          },
          _count: { select: { documents: true, alertRules: true } },
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users.map((u) => {
        const of = (metric: UsageMetric) =>
          u.usageCounters.find((c) => c.metric === metric)?.count ?? 0;
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          tier: u.subscription?.plan.tier ?? 'FREE',
          planName: u.subscription?.plan.name ?? 'Free',
          subscriptionStatus: u.subscription?.status ?? null,
          grantedByAdmin: u.subscription?.grantedByAdmin ?? false,
          currentPeriodEnd: u.subscription?.currentPeriodEnd ?? null,
          cancelAtPeriodEnd: u.subscription?.cancelAtPeriodEnd ?? false,
          usage: {
            aiQuestions: of(UsageMetric.AI_QUESTION),
            documentUploads: of(UsageMetric.DOCUMENT_UPLOAD),
            whatsappNotifications: of(UsageMetric.WHATSAPP_NOTIFICATION),
            documents: u._count.documents,
            alertRules: u._count.alertRules,
          },
        };
      }),
      meta: { total, limit, offset, periodStart },
    };
  }

  /** Housekeeping: drop event detail older than the retention window. */
  async pruneEvents(olderThanDays = 120): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.usageEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) this.logger.log(`Pruned ${count} usage event(s) older than ${olderThanDays}d`);
    return count;
  }
}
