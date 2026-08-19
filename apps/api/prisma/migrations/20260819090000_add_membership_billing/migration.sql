-- Membership & billing: plan definitions, subscriptions, usage metering.

CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'MAX');
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE');
CREATE TYPE "UsageMetric" AS ENUM ('AI_QUESTION', 'DOCUMENT_UPLOAD', 'WHATSAPP_NOTIFICATION', 'ALERT_RULE');

CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT,
    "description" TEXT,
    "price_monthly_cents" INTEGER NOT NULL DEFAULT 0,
    "price_yearly_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "stripe_product_id" TEXT,
    "stripe_price_id" TEXT,
    "stripe_yearly_price_id" TEXT,
    "max_documents" INTEGER,
    "max_ai_questions_per_month" INTEGER,
    "max_alert_rules" INTEGER,
    "max_whatsapp_per_month" INTEGER,
    "max_upload_mb" INTEGER NOT NULL DEFAULT 5,
    "allow_instant_alerts" BOOLEAN NOT NULL DEFAULT false,
    "features" JSONB,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plans_tier_key" ON "plans"("tier");

CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "canceled_at" TIMESTAMP(3),
    "granted_by_admin" BOOLEAN NOT NULL DEFAULT false,
    "grant_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");
CREATE UNIQUE INDEX "subscriptions_stripe_customer_id_key" ON "subscriptions"("stripe_customer_id");
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");
CREATE INDEX "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

CREATE TABLE "usage_counters" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "metric" "UsageMetric" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "usage_counters_user_id_metric_period_start_key"
    ON "usage_counters"("user_id", "metric", "period_start");
CREATE INDEX "usage_counters_period_start_idx" ON "usage_counters"("period_start");

CREATE TABLE "usage_events" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "metric" "UsageMetric" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "usage_events_user_id_created_at_idx" ON "usage_events"("user_id", "created_at");
CREATE INDEX "usage_events_metric_created_at_idx" ON "usage_events"("metric", "created_at");

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the three tiers. Prices are placeholders an admin edits in the UI;
-- Stripe price ids are filled in from the Stripe dashboard.
INSERT INTO "plans" ("id","tier","name","tagline","description",
    "price_monthly_cents","currency","max_documents","max_ai_questions_per_month",
    "max_alert_rules","max_whatsapp_per_month","max_upload_mb","allow_instant_alerts",
    "features","is_public","sort_order","updated_at")
VALUES
 (gen_random_uuid(),'FREE','Free','Stay informed','Browse every public notice, with a taste of the AI tools.',
  0,'usd',3,20,3,0,5,false,
  '["All government notices","3 documents","20 AI questions / month","3 alert rules","Daily digest alerts"]'::jsonb,
  true,0,NOW()),
 (gen_random_uuid(),'PRO','Pro','For professionals','Serious monitoring: instant alerts and a far bigger AI allowance.',
  900,'usd',50,500,25,200,25,true,
  '["Everything in Free","50 documents","500 AI questions / month","25 alert rules","Instant WhatsApp alerts","25 MB uploads","Priority support"]'::jsonb,
  true,1,NOW()),
 (gen_random_uuid(),'MAX','Max','For teams','Unlimited research across the full notice corpus.',
  2900,'usd',NULL,NULL,NULL,1000,100,true,
  '["Everything in Pro","Unlimited documents","Unlimited AI questions","Unlimited alert rules","100 MB uploads","Early access to new features"]'::jsonb,
  true,2,NOW());
