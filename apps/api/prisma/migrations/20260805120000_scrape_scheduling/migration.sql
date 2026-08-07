-- AlterTable: automatic scheduling + sitemap fast-path for scrape sources.
ALTER TABLE "scrape_sources"
    ADD COLUMN "poll_interval_seconds" INTEGER NOT NULL DEFAULT 900,
    ADD COLUMN "sitemap_url" TEXT,
    ADD COLUMN "sitemap_checked_at" TIMESTAMP(3);
