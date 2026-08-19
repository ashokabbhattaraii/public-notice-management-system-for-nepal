-- New enums
CREATE TYPE "AlertPriority" AS ENUM ('NORMAL', 'HIGH');
CREATE TYPE "AlertUrgency" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "DigestFrequency" AS ENUM ('INSTANT', 'DAILY', 'WEEKLY');

-- User: digest delivery cadence
ALTER TABLE "users"
  ADD COLUMN "digest_frequency" "DigestFrequency" NOT NULL DEFAULT 'INSTANT',
  ADD COLUMN "last_digest_sent_at" TIMESTAMP(3);

-- AlertNotification: PENDING = queued for the next digest, not yet delivered
ALTER TYPE "AlertNotificationStatus" ADD VALUE 'PENDING';

-- AlertRule: add the new multi-dimension filter columns
ALTER TABLE "alert_rules"
  ADD COLUMN "priority" "AlertPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN "keywords" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "exclude_keywords" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "categories" "ScrapedItemCategory"[] NOT NULL DEFAULT '{}',
  ADD COLUMN "organizations" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "min_urgency" "AlertUrgency",
  ADD COLUMN "deadline_within_days" INTEGER;

-- Migrate existing rows from the old single-dimension (type + conditions) shape
UPDATE "alert_rules"
SET "keywords" = ARRAY(SELECT jsonb_array_elements_text("conditions"))
WHERE "type" = 'KEYWORD';

UPDATE "alert_rules"
SET "organizations" = ARRAY(SELECT jsonb_array_elements_text("conditions"))
WHERE "type" = 'ORGANIZATION';

UPDATE "alert_rules"
SET "categories" = ARRAY(
  SELECT UPPER(elem)::"ScrapedItemCategory"
  FROM jsonb_array_elements_text("conditions") AS elem
  WHERE UPPER(elem) IN ('NOTICE','NEWS','PRESS_RELEASE','CIRCULAR','TENDER','VACANCY','JOB','INTERNSHIP','OTHER')
)
WHERE "type" = 'CATEGORY';

-- Drop the old columns/enum now that data has been migrated
ALTER TABLE "alert_rules" DROP COLUMN "type";
ALTER TABLE "alert_rules" DROP COLUMN "conditions";
DROP TYPE "AlertRuleType";
