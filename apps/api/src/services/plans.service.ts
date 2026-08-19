import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Plan, PlanTier, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TtlCache } from '../common/cache/ttl-cache';

/** A plan's limits, resolved for enforcement. `null` means unlimited. */
export interface PlanLimits {
  maxDocuments: number | null;
  maxAiQuestionsPerMonth: number | null;
  maxAlertRules: number | null;
  maxWhatsappPerMonth: number | null;
  maxUploadMb: number;
  allowInstantAlerts: boolean;
}

/** What every quota check and UI panel needs to know about a user. */
export interface EffectivePlan {
  plan: Plan;
  limits: PlanLimits;
  status: SubscriptionStatus;
  /** True when the plan is the implicit free tier (no subscription row). */
  isDefault: boolean;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/**
 * Plan definitions live in the database so an admin can retune prices, limits
 * and copy without a deploy. This service is the single place that answers
 * "what is this user allowed to do?", and it caches aggressively because every
 * quota check calls it.
 */
@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  // Plan rows change only when an admin edits them, but are read on every
  // metered request. Short TTL keeps edits visible quickly without hammering
  // Postgres; `invalidate()` makes admin edits take effect immediately.
  private readonly planCache = new TtlCache<Plan[]>(60_000);

  constructor(private readonly prisma: PrismaService) {}

  invalidate(): void {
    this.planCache.clear();
  }

  async listAll(): Promise<Plan[]> {
    return this.planCache.remember('all', () =>
      this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } }),
    ) as Promise<Plan[]>;
  }

  /** Plans shown on the public pricing page. */
  async listPublic(): Promise<Plan[]> {
    const plans = await this.listAll();
    return plans.filter((p) => p.isPublic);
  }

  async findByTier(tier: PlanTier): Promise<Plan> {
    const plans = await this.listAll();
    const plan = plans.find((p) => p.tier === tier);
    if (!plan) throw new NotFoundException(`Plan ${tier} is not configured`);
    return plan;
  }

  async findByStripePriceId(priceId: string): Promise<Plan | undefined> {
    const plans = await this.listAll();
    return plans.find(
      (p) => p.stripePriceId === priceId || p.stripeYearlyPriceId === priceId,
    );
  }

  static limitsOf(plan: Plan): PlanLimits {
    return {
      maxDocuments: plan.maxDocuments,
      maxAiQuestionsPerMonth: plan.maxAiQuestionsPerMonth,
      maxAlertRules: plan.maxAlertRules,
      maxWhatsappPerMonth: plan.maxWhatsappPerMonth,
      maxUploadMb: plan.maxUploadMb,
      allowInstantAlerts: plan.allowInstantAlerts,
    };
  }

  /**
   * The plan actually in force for a user.
   *
   * Users with no subscription row are FREE — signup writes no billing data
   * and every pre-existing account keeps working. A lapsed subscription
   * (PAST_DUE past its grace, CANCELED) also falls back to FREE rather than
   * losing access entirely: the account stays usable at the free allowance.
   */
  async effectivePlanFor(userId: string): Promise<EffectivePlan> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    const entitled =
      subscription &&
      (subscription.status === SubscriptionStatus.ACTIVE ||
        subscription.status === SubscriptionStatus.TRIALING ||
        // Past-due keeps working until the period actually ends, so a failed
        // card retry doesn't lock a paying customer out mid-month.
        (subscription.status === SubscriptionStatus.PAST_DUE &&
          (!subscription.currentPeriodEnd || subscription.currentPeriodEnd > new Date())));

    if (!subscription || !entitled) {
      const free = await this.findByTier(PlanTier.FREE);
      return {
        plan: free,
        limits: PlansService.limitsOf(free),
        status: subscription?.status ?? SubscriptionStatus.ACTIVE,
        isDefault: true,
        currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      };
    }

    return {
      plan: subscription.plan,
      limits: PlansService.limitsOf(subscription.plan),
      status: subscription.status,
      isDefault: false,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    };
  }

  /** Admin: update a plan definition. Invalidates the cache immediately. */
  async update(tier: PlanTier, data: Prisma.PlanUpdateInput): Promise<Plan> {
    const plan = await this.prisma.plan.update({ where: { tier }, data });
    this.invalidate();
    this.logger.log(`Plan ${tier} updated`);
    return plan;
  }
}
