import { Global, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import {
  BillingController,
  PlansController,
  StripeWebhookController,
} from '../controllers/billing.controller';
import { AdminBillingController } from '../controllers/admin-billing.controller';
import { PlansService } from '../services/plans.service';
import { UsageService } from '../services/usage.service';
import { QuotaService } from '../services/quota.service';
import { StripeService } from '../services/stripe.service';
import { SubscriptionsService } from '../services/subscriptions.service';
import { TokenRevocationModule } from '../common/token-revocation.module';

/**
 * Membership, metering and payments.
 *
 * Global because QuotaService is consumed by feature modules all over the app
 * (documents, rag, notices, alerts, notifications) — every metered action asks
 * it for permission, and threading an import through each module adds noise
 * without adding clarity.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    HttpModule.register({ timeout: 20_000 }),
    // BillingController and AdminBillingController are guarded.
    TokenRevocationModule,
  ],
  controllers: [
    PlansController,
    BillingController,
    StripeWebhookController,
    AdminBillingController,
  ],
  providers: [PlansService, UsageService, QuotaService, StripeService, SubscriptionsService],
  exports: [PlansService, UsageService, QuotaService, SubscriptionsService],
})
export class BillingModule {}
