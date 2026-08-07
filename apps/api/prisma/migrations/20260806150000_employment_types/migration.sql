-- Expand the notice taxonomy with employment-specific types.
-- Jobs and career postings were previously collapsed into VACANCY by the
-- scraper's slug map; now JOB (जागिर/career) and INTERNSHIP (इन्टर्नशिप)
-- are first-class types so the public filter can target them directly.
--
-- PG 17 supports ALTER TYPE ... ADD VALUE inside a transaction, so the enum
-- expansion + backfill are safe in a single script.

ALTER TYPE "ScrapedItemCategory" ADD VALUE IF NOT EXISTS 'JOB';
ALTER TYPE "ScrapedItemCategory" ADD VALUE IF NOT EXISTS 'INTERNSHIP';

-- Backfill existing VACANCY rows into the finer-grained types by keyword.
-- Run BEFORE rows are cats correct; the scraper also produces these from now
-- on, so this only covers rows scraped under the old taxonomy.
UPDATE "scraped_items"
SET "category" = 'INTERNSHIP'
WHERE "category" = 'VACANCY'
  AND (
    lower("title") LIKE '%intern%'
    OR lower("content_text") LIKE '%intern%'
  );

UPDATE "scraped_items"
SET "category" = 'JOB'
WHERE "category" = 'VACANCY'
  AND (
    lower("title") LIKE '%job%'
    OR lower("title") LIKE '%career%'
    OR lower("content_text") LIKE '%job vacancy%'
    OR lower("content_text") LIKE '%career%'
  );