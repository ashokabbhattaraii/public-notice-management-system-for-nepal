-- AlterTable
ALTER TABLE "alert_rules" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
