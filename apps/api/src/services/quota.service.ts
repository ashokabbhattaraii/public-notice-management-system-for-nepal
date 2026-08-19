import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PlanTier, UsageMetric } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from './plans.service';
import { UsageService } from './usage.service';

/** Machine-readable reasons, so the UI can tailor the upgrade prompt. */
export type QuotaKind =
  | 'ai_questions'
  | 'documents'
  | 'alert_rules'
  | 'whatsapp_notifications'
  | 'upload_size'
  | 'instant_alerts';

export interface QuotaDenial {
  kind: QuotaKind;
  limit: number | null;
  used: number;
  tier: PlanTier;
  message: string;
}

/**
 * 402 Payment Required — the one status that unambiguously means "your plan
 * doesn't cover this". The body carries `quota` so the frontend can show the
 * right meter and a targeted upgrade CTA instead of a generic error toast.
 */
export class QuotaExceededException extends HttpException {
  constructor(readonly denial: QuotaDenial) {
    super(
      {
        statusCode: HttpStatus.PAYMENT_REQUIRED,
        error: 'Payment Required',
        message: denial.message,
        quota: denial,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}

/**
 * Plan enforcement.
 *
 * Every check is "assert, then record" — never record first. A refused request
 * must not consume allowance, otherwise a user at their limit would burn quota
 * on requests that returned an error.
 *
 * Downgrades never delete data: `assertCanAddDocument` blocks *new* uploads
 * while over the cap, but existing documents stay readable. That's the
 * agreed hard-block behaviour, applied only to new usage.
 */
@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
    private readonly usage: UsageService,
  ) {}

  private deny(denial: QuotaDenial): never {
    this.logger.log(
      `Quota denied (${denial.kind}) for tier=${denial.tier}: ${denial.used}/${denial.limit}`,
    );
    throw new QuotaExceededException(denial);
  }

  /** Monthly AI questions: RAG chat, notice Q&A and the public chatbot. */
  async assertCanAskAi(userId: string): Promise<void> {
    const { plan, limits } = await this.plans.effectivePlanFor(userId);
    if (limits.maxAiQuestionsPerMonth === null) return;

    const used = await this.usage.currentCount(userId, UsageMetric.AI_QUESTION);
    if (used >= limits.maxAiQuestionsPerMonth) {
      this.deny({
        kind: 'ai_questions',
        limit: limits.maxAiQuestionsPerMonth,
        used,
        tier: plan.tier,
        message: `You've used all ${limits.maxAiQuestionsPerMonth} AI questions included in ${plan.name} this month. Upgrade for a bigger allowance.`,
      });
    }
  }

  recordAiQuestion(userId: string, context?: Record<string, unknown>) {
    return this.usage.record(userId, UsageMetric.AI_QUESTION, 1, context);
  }

  /**
   * Documents are a *stock*, not a flow: the cap is on how many a user keeps
   * embedded at once, so deleting one frees a slot.
   */
  async assertCanAddDocument(userId: string, fileSizeBytes?: number): Promise<void> {
    const { plan, limits } = await this.plans.effectivePlanFor(userId);

    if (fileSizeBytes !== undefined) {
      const maxBytes = limits.maxUploadMb * 1024 * 1024;
      if (fileSizeBytes > maxBytes) {
        this.deny({
          kind: 'upload_size',
          limit: limits.maxUploadMb,
          used: Math.round(fileSizeBytes / 1024 / 1024),
          tier: plan.tier,
          message: `This file is ${(fileSizeBytes / 1024 / 1024).toFixed(1)} MB. ${plan.name} allows uploads up to ${limits.maxUploadMb} MB.`,
        });
      }
    }

    if (limits.maxDocuments === null) return;

    const owned = await this.prisma.document.count({ where: { uploadedBy: userId } });
    if (owned >= limits.maxDocuments) {
      this.deny({
        kind: 'documents',
        limit: limits.maxDocuments,
        used: owned,
        tier: plan.tier,
        message: `${plan.name} includes ${limits.maxDocuments} documents and you have ${owned}. Delete one or upgrade to add more.`,
      });
    }
  }

  recordDocumentUpload(userId: string, context?: Record<string, unknown>) {
    return this.usage.record(userId, UsageMetric.DOCUMENT_UPLOAD, 1, context);
  }

  /** Alert rules are a stock too — the cap is on rules held, not created. */
  async assertCanAddAlertRule(userId: string): Promise<void> {
    const { plan, limits } = await this.plans.effectivePlanFor(userId);
    if (limits.maxAlertRules === null) return;

    const owned = await this.prisma.alertRule.count({ where: { userId } });
    if (owned >= limits.maxAlertRules) {
      this.deny({
        kind: 'alert_rules',
        limit: limits.maxAlertRules,
        used: owned,
        tier: plan.tier,
        message: `${plan.name} includes ${limits.maxAlertRules} alert rules and you have ${owned}. Delete one or upgrade for more.`,
      });
    }
  }

  /**
   * Instant delivery is a paid feature; free users are held to a digest.
   * Returns the cadence the user is actually allowed, so callers can degrade
   * gracefully instead of failing a settings save.
   */
  async canUseInstantAlerts(userId: string): Promise<boolean> {
    const { limits } = await this.plans.effectivePlanFor(userId);
    return limits.allowInstantAlerts;
  }

  async assertCanUseInstantAlerts(userId: string): Promise<void> {
    const { plan, limits } = await this.plans.effectivePlanFor(userId);
    if (limits.allowInstantAlerts) return;
    this.deny({
      kind: 'instant_alerts',
      limit: null,
      used: 0,
      tier: plan.tier,
      message: `Instant alerts are a paid feature. ${plan.name} delivers a daily digest instead.`,
    });
  }

  /**
   * WhatsApp deliveries cost real money per message, so this is checked by the
   * *sender* rather than a user request. It returns a boolean instead of
   * throwing: a delivery that would exceed the cap is skipped and logged, not
   * an error surfaced to anyone.
   */
  async canSendWhatsapp(userId: string): Promise<boolean> {
    const { limits } = await this.plans.effectivePlanFor(userId);
    if (limits.maxWhatsappPerMonth === null) return true;
    if (limits.maxWhatsappPerMonth === 0) return false;

    const used = await this.usage.currentCount(userId, UsageMetric.WHATSAPP_NOTIFICATION);
    return used < limits.maxWhatsappPerMonth;
  }

  recordWhatsappNotification(userId: string, context?: Record<string, unknown>) {
    return this.usage.record(userId, UsageMetric.WHATSAPP_NOTIFICATION, 1, context);
  }

  /** Everything the billing panel needs: plan, limits and usage vs each. */
  async entitlementsFor(userId: string) {
    const [effective, usage, documents, alertRules] = await Promise.all([
      this.plans.effectivePlanFor(userId),
      this.usage.snapshotFor(userId),
      this.prisma.document.count({ where: { uploadedBy: userId } }),
      this.prisma.alertRule.count({ where: { userId } }),
    ]);

    const meter = (used: number, limit: number | null) => ({
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      exceeded: limit !== null && used >= limit,
    });

    return {
      plan: {
        tier: effective.plan.tier,
        name: effective.plan.name,
        tagline: effective.plan.tagline,
        priceMonthlyCents: effective.plan.priceMonthlyCents,
        currency: effective.plan.currency,
      },
      status: effective.status,
      isDefault: effective.isDefault,
      currentPeriodEnd: effective.currentPeriodEnd,
      cancelAtPeriodEnd: effective.cancelAtPeriodEnd,
      limits: effective.limits,
      usage: {
        aiQuestions: meter(usage.aiQuestions, effective.limits.maxAiQuestionsPerMonth),
        documents: meter(documents, effective.limits.maxDocuments),
        alertRules: meter(alertRules, effective.limits.maxAlertRules),
        whatsappNotifications: meter(
          usage.whatsappNotifications,
          effective.limits.maxWhatsappPerMonth,
        ),
        periodStart: usage.periodStart,
        periodEnd: usage.periodEnd,
      },
    };
  }
}
