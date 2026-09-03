-- AlterTable: flag sources auto-created by the admin "paste a link" quick-scrape flow.
ALTER TABLE "scrape_sources"
    ADD COLUMN "is_ad_hoc" BOOLEAN NOT NULL DEFAULT false;
