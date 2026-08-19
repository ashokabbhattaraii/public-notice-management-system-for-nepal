-- CreateEnum
CREATE TYPE "AlertRuleType" AS ENUM ('KEYWORD', 'CATEGORY', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "AlertNotificationStatus" AS ENUM ('SENT', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScrapedItemCategory" ADD VALUE 'JOB';
ALTER TYPE "ScrapedItemCategory" ADD VALUE 'INTERNSHIP';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "whatsapp_alerts_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsapp_number" TEXT,
ADD COLUMN     "whatsapp_otp_code" TEXT,
ADD COLUMN     "whatsapp_otp_expires_at" TIMESTAMP(3),
ADD COLUMN     "whatsapp_otp_requested_at" TIMESTAMP(3),
ADD COLUMN     "whatsapp_pending_number" TEXT,
ADD COLUMN     "whatsapp_verified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "AlertRuleType" NOT NULL,
    "name" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "match_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "alert_rule_id" UUID NOT NULL,
    "scraped_item_id" UUID NOT NULL,
    "status" "AlertNotificationStatus" NOT NULL,
    "error" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_rules_user_id_idx" ON "alert_rules"("user_id");

-- CreateIndex
CREATE INDEX "alert_notifications_alert_rule_id_idx" ON "alert_notifications"("alert_rule_id");

-- CreateIndex
CREATE UNIQUE INDEX "alert_notifications_user_id_scraped_item_id_key" ON "alert_notifications"("user_id", "scraped_item_id");

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_notifications" ADD CONSTRAINT "alert_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_notifications" ADD CONSTRAINT "alert_notifications_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_notifications" ADD CONSTRAINT "alert_notifications_scraped_item_id_fkey" FOREIGN KEY ("scraped_item_id") REFERENCES "scraped_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

