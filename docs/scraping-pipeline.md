# Scraping Pipeline — End-to-End Architecture

## Pipeline Diagram

```
┌────────────────────────────────────────────────────────────────────────────────────────────┐
│                              PUBLIC NOTICE SCRAPING PIPELINE                                │
└────────────────────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐        ┌──────────────────┐        ┌──────────────────────┐
│  Admin UI    │        │  NestJS API      │        │  Python AI Service   │
│  (Next.js)   │        │  (Orchestrator)  │        │  (Crawl Engine)      │
└──────┬───────┘        └────────┬─────────┘        └──────────┬───────────┘
       │                         │                              │
       │  1. Click "Run"         │                              │
       ├────────────────────────►│                              │
       │                         │  2. Create ScrapeRun         │
       │                         │     (status: RUNNING)        │
       │                         │                              │
       │                         │  3. POST /scrape/source      │
       │                         ├─────────────────────────────►│
       │                         │     {base_url,               │
       │                         │      category_urls,          │
       │                         │      cached_schemas,         │  4. Schema Resolution
       │                         │      known_urls,             │  ┌────────────────────┐
       │                         │      pagination}             │  │ cached? ─► validate │
       │                         │                              │  │    │ (extract rows) │
       │                         │                              │  │    ▼ zero rows?     │
       │                         │                              │  │ LLM (Groq) detect   │
       │                         │                              │  │    │ fail?          │
       │                         │                              │  │    ▼               │
       │                         │                              │  │ Heuristic detect   │
       │                         │                              │  └────────────────────┘
       │                         │                              │
       │                         │                              │  5. Paginated Listing Crawl
       │                         │                              │  ┌────────────────────────┐
       │                         │                              │  │ for page in 1..max:    │
       │                         │                              │  │   build URL            │
       │                         │                              │  │   extract rows (CSS)   │
       │                         │                              │  │   if 0 new → stop      │
       │                         │                              │  │   if all known → stop  │
       │                         │                              │  └────────────────────────┘
       │                         │                              │
       │  Poll progress          │                              │  6. Detail Page Fetch
       │  GET /progress/:runId   │  Proxy to AI service         │  ┌────────────────────────┐
       ├────────────────────────►├─────────────────────────────►│  │ for each new URL:      │
       │◄────────────────────────┤◄─────────────────────────────┤  │   headless fetch       │
       │  {messages[]}           │                              │  │   extract: title,      │
       │                         │                              │  │     content, date,     │
       │                         │                              │  │     attachment         │
       │                         │                              │  │   detect PDF viewers   │
       │                         │                              │  │   scan JS for PDFs     │
       │                         │                              │  └────────────────────────┘
       │                         │                              │
       │                         │  7. Return results           │
       │                         │◄─────────────────────────────┤
       │                         │  {items[], schemas{}}        │
       │                         │                              │
       │                         │  8. Deduplication            │
       │                         │  ┌────────────────────┐      │
       │                         │  │ sha256(title+text)  │      │
       │                         │  │ new → INSERT        │      │
       │                         │  │ changed → UPDATE    │      │
       │                         │  │ same → SKIP         │      │
       │                         │  └────────────────────┘      │
       │                         │                              │
       │                         │  9. AI Analysis              │
       │                         │  ┌────────────────────┐      │
       │                         │  │ POST /notices/analyze ────►│  Gemini/Groq LLM
       │                         │  │ → summary           │     │  → summary
       │                         │  │ → key_facts[]       │     │  → key_facts
       │                         │  │ → tags[]            │     │  → tags
       │                         │  └────────────────────┘      │
       │                         │                              │
       │                         │  10. Finalize                │
       │                         │  ┌────────────────────┐      │
       │                         │  │ Update ScrapeRun    │      │
       │                         │  │ Cache schemas       │      │
       │                         │  │ Release source lock │      │
       │                         │  └────────────────────┘      │
       │                         │                              │
       │  Dashboard updated      │                              │
       │◄────────────────────────┤                              │
       │                         │                              │
└──────┴───────────────────────────────────────────────────────────────────────────────────────

┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       DATA STORES                                            │
├──────────────────────────┬───────────────────────────────────────────────────────────────────┤
│  PostgreSQL (Prisma)     │  scrape_sources → scraped_items → scrape_runs                     │
└──────────────────────────┴───────────────────────────────────────────────────────────────────┘
```

---

## Phase Breakdown

### Phase 1: Trigger (Admin UI → NestJS)

| Step | Actor | Action |
|------|-------|--------|
| 1.1 | Admin | Clicks "Run Now" on a configured source |
| 1.2 | Web | `POST /admin/scraping/sources/:id/run` (JWT + admin role) |
| 1.3 | API | Validates source is enabled and not already running |
| 1.4 | API | Creates `ScrapeRun` record (status: `RUNNING`) |
| 1.5 | API | Adds source ID to in-memory lock set |
| 1.6 | API | Returns `{ runId }` immediately (fire-and-forget) |

### Phase 2: Preparation (NestJS → AI Service)

| Step | Actor | Action |
|------|-------|--------|
| 2.1 | API | Collects `category_urls` from source config (NOTICE, NEWS, PRESS_RELEASE) |
| 2.2 | API | Fetches all `known_urls` from `scraped_items` for this source |
| 2.3 | API | Gathers `cached_schemas` (JSON) stored on the source row |
| 2.4 | API | Posts to `AI_SERVICE_URL/scrape/source` with 10-minute timeout |

**Payload:**
```json
{
  "base_url": "https://mofa.gov.np",
  "category_urls": { "NOTICE": "https://mofa.gov.np/notices/", "NEWS": "https://mofa.gov.np/news/" },
  "cached_schemas": { "NOTICE": { "baseSelector": "...", "fields": [...] } },
  "known_urls": ["https://mofa.gov.np/notices/123", ...],
  "max_pages": 3,
  "run_id": "clxyz...",
  "pagination": { "type": "QUERY_PARAM", "param": "page", "start_page": 1 }
}
```

### Phase 3: Schema Resolution (AI Service)

The scraper needs a CSS extraction schema to pull structured data from listing pages. Schema resolution is a **tiered fallback**:

```
┌─────────────────────────────────────────────────────────┐
│              SCHEMA RESOLUTION (per category)            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── Tier 1: Cached Schema ────────────────────────┐   │
│  │  • Use schema stored from last successful run     │   │
│  │  • Validate: extract rows → if rows > 0 → USE IT │   │
│  │  • If 0 rows → site markup changed → re-detect   │   │
│  └──────────────────────────────────────────────────┘   │
│              │ (0 rows)                                  │
│              ▼                                           │
│  ┌─── Tier 2: LLM Detection (Groq) ────────────────┐   │
│  │  • Requires GROQ_API_KEY configured               │   │
│  │  • Sends cleaned HTML (≤30KB) to LLM              │   │
│  │  • Prompt: identify repeating rows, CSS selectors │   │
│  │  • Validate: extract rows → if rows > 0 → USE IT │   │
│  │  • Disambiguates main listing from sidebar widgets│   │
│  └──────────────────────────────────────────────────┘   │
│              │ (fail / no API key)                       │
│              ▼                                           │
│  ┌─── Tier 3: Heuristic Detection (free) ──────────┐   │
│  │  • Parse DOM, group siblings by tag+class         │   │
│  │  • Score groups: count × row-hint boost           │   │
│  │  • From best group's sample row, derive:          │   │
│  │    - detail_href (best anchor → detail page)      │   │
│  │    - title (longest text in row)                   │   │
│  │    - published_raw (date-like element)             │   │
│  │    - attachment_href (file-extension link)         │   │
│  │  • Validate: extract rows → if rows > 0 → USE IT │   │
│  └──────────────────────────────────────────────────┘   │
│              │ (fail)                                    │
│              ▼                                           │
│         SKIP this category                              │
└─────────────────────────────────────────────────────────┘
```

**Schema Shape:**
```json
{
  "name": "auto_detected | llm_detected",
  "baseSelector": "table tbody tr",
  "fields": [
    { "name": "detail_href", "selector": "a", "type": "attribute", "attribute": "href" },
    { "name": "title", "selector": "td:nth-child(2)", "type": "text" },
    { "name": "published_raw", "selector": "td:nth-child(3)", "type": "text" },
    { "name": "attachment_href", "selector": "td:nth-child(4) a", "type": "attribute", "attribute": "href" }
  ]
}
```

### Phase 4: Paginated Listing Crawl (AI Service)

```
┌───────────────────────────────────────────────────────────────┐
│                   PAGINATION ENGINE                            │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Pagination Types:                                            │
│  ┌────────────────┬──────────────────────────────────────┐    │
│  │ QUERY_PARAM    │ ?page=N (default, most gov sites)    │    │
│  │ PATH_TEMPLATE  │ /notices/page/{page} (WordPress)     │    │
│  │ NONE           │ Single page, no pagination           │    │
│  └────────────────┴──────────────────────────────────────┘    │
│                                                               │
│  Stop Conditions:                                             │
│  • max_pages reached (default 3, max 20)                      │
│  • 0 rows extracted on a page                                 │
│  • All rows on a page are already in known_urls               │
│                                                               │
│  Per-Page Flow:                                               │
│  1. Build paginated URL                                       │
│  2. Crawl with JsonCssExtractionStrategy(schema)              │
│  3. For each row → resolve absolute URL                       │
│  4. Deduplicate within this run (seen_urls set)               │
│  5. Check against known_urls (skip detail if known)           │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Phase 5: Detail Page Extraction + Attachment Scanning (AI Service)

For each **new** URL (not in `known_urls`), the scraper fetches the full article page:

```
┌───────────────────────────────────────────────────────────────┐
│          DETAIL PAGE EXTRACTION + ATTACHMENT SCAN              │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Headless Chromium fetch (crawl4ai + Playwright)           │
│                                                               │
│  2. DOM Cleanup:                                              │
│     Strip: script, style, noscript, svg, nav, footer,         │
│            header, aside                                       │
│                                                               │
│  3. Extract Fields:                                           │
│     ┌───────────────┬──────────────────────────────────┐      │
│     │ title         │ <h1> text content                │      │
│     │ published_at  │ <time> tag text                  │      │
│     │ content_text  │ Priority container text:         │      │
│     │               │   article > main > [role=main]   │      │
│     │               │   > .entry-content > .post-      │      │
│     │               │   content (10+ selectors)        │      │
│     │ content_html  │ Raw HTML of content container    │      │
│     │ attachment    │ File-extension link in body      │      │
│     └───────────────┴──────────────────────────────────┘      │
│                                                               │
│  4. Full-page Attachment Scan (NEW):                          │
│     Scan ENTIRE page (not just content container) for:        │
│     • Links ending in: .pdf .doc(x) .xls(x) .jpg .png .zip   │
│     • Links with path hints: /download/ /uploads/ /attachment/│
│     • JS-embedded PDF URLs (pdf.js, DearFlip viewers)         │
│     Returns: [{url, label}] for the Attachment model          │
│                                                               │
│  5. Slug-based Category Inference (NEW):                      │
│     Parse URL path segments against category slug map:        │
│     /category/press-release/… → PRESS_RELEASE                 │
│     /tender/… → TENDER, /vacancy/… → VACANCY, etc.           │
│     Falls back to listing category if slug is ambiguous       │
│                                                               │
│  6. Metadata Extraction (NEW):                                │
│     Regex-based extraction of high-confidence fields:         │
│     • referenceNumber (e.g. "Notice No: 123/082-83")          │
│     • deadline (parsed to ISO date if confident)              │
│     Returns null if confidence is low — no guessing           │
│                                                               │
│  7. PDF Viewer Detection:                                     │
│     If content container has pdf.js / DearFlip markers:       │
│     → content_text = null (it's toolbar chrome, not content)  │
│     → Scan <script> tags for JS-embedded PDF URLs             │
│                                                               │
│  8. Date Parsing (supports both calendars):                   │
│     • Gregorian: 14 format patterns                           │
│     • Bikram Sambat: Devanagari month names + digits          │
│       (e.g., "जेठ २४, २०८३" → AD date via nepali_datetime)   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Phase 5.5: Concurrent AI Summarization (AI Service — NEW)

Runs **in parallel** with crawling, not as a separate pass afterward:

```
┌───────────────────────────────────────────────────────────────┐
│            CONCURRENT AI SUMMARIZATION                         │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Triggered: as soon as content_text is extracted per item      │
│  Concurrency: asyncio.Semaphore(4) — up to 4 LLM calls       │
│               run simultaneously alongside crawling            │
│                                                               │
│  Input: title + content_text (truncated to 4KB)               │
│                                                               │
│  LLM (Groq) produces JSON:                                    │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  summary    — 2-3 sentence plain-language summary      │   │
│  │  urgency    — LOW | MEDIUM | HIGH                      │   │
│  │  category   — confirms or overrides slug inference     │   │
│  │  category_confidence — 0.0–1.0                         │   │
│  │  key_facts  — array of key facts                       │   │
│  │  tags       — array of classification tags             │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  Stored on ScrapedItem: aiSummary, aiUrgency,                 │
│  aiCategoryConfidence. On failure → null (non-blocking).      │
│                                                               │
│  Progress messages: "Summarizing: <title>…"                   │
│  Final: "Summarization complete: X succeeded, Y failed"       │
│                                                               │
│  Note: Crawling item N+1 does NOT wait for item N's           │
│  summarization — they overlap via asyncio tasks.              │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Phase 6: Deduplication & Persistence (NestJS)

```
┌───────────────────────────────────────────────────────────────┐
│                  DEDUP & PERSISTENCE                           │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Content Hash = sha256(title + "|" + content_text)            │
│                                                               │
│  Decision Matrix:                                             │
│  ┌──────────────────────┬─────────────────────────────────┐   │
│  │ sourceUrl not in DB  │ → INSERT (new item)             │   │
│  │ hash differs         │ → UPDATE (content changed)      │   │
│  │ attachment changed   │ → UPDATE (attachment only)      │   │
│  │ hash matches         │ → SKIP (no change)             │   │
│  └──────────────────────┴─────────────────────────────────┘   │
│                                                               │
│  Batch optimization:                                          │
│  • Single findMany for all incoming URLs (not N queries)      │
│  • Map by sourceUrl for O(1) lookup per item                  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Phase 7: AI Analysis Fallback (NestJS → AI Service)

For items where concurrent summarization failed or was skipped (no content):

```
┌───────────────────────────────────────────────────────────────┐
│              AI ANALYSIS FALLBACK (lazy, per item)             │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Two triggers:                                                │
│  1. On persist: if ai_summary is null AND content exists,     │
│     call POST /notices/analyze { title, content }             │
│  2. On first public view: lazy analysis if aiAnalyzedAt is    │
│     null or stale (content changed since last analysis)       │
│                                                               │
│  LLM (Gemini with Groq fallback):                             │
│  ┌────────────────────────────────────────────────────────┐   │
│  │  Output:                                               │   │
│  │    • summary    — 2-3 sentence AI summary              │   │
│  │    • key_facts  — array of key facts/dates/numbers     │   │
│  │    • tags       — array of classification tags         │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  This is the FALLBACK path. Primary summarization happens     │
│  concurrently during the crawl itself (Phase 5.5).            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Phase 8: Persistence + Attachments (NestJS)

The NestJS service persists each item AND creates Attachment records:

```
┌───────────────────────────────────────────────────────────────┐
│             PERSIST ITEMS + ATTACHMENTS                        │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  For each new item:                                           │
│  1. INSERT scraped_item with all AI-enriched fields           │
│  2. createMany Attachment records (url, label, mimeType)      │
│                                                               │
│  For each updated item:                                       │
│  1. UPDATE scraped_item fields                                │
│  2. Delete old attachments → createMany new ones              │
│                                                               │
│  New fields stored: sourceSlug, aiSummary, aiUrgency,         │
│  aiCategoryConfidence, metadata (JSON)                        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Phase 9: Finalization (NestJS)

| Step | Action |
|------|--------|
| 9.1 | Update `ScrapeRun` → status: SUCCESS, counts: found/new/updated/skipped/summarized/summaryFailed |
| 9.2 | Update `ScrapeSource` → `lastRunAt`, `lastStatus`, cache working schemas |
| 9.3 | Release in-memory source lock (`runningSourceIds.delete`) |
| 9.4 | On failure: status → FAILED, error message stored |

---

## Data Model

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            DATABASE SCHEMA                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐         ┌───────────────────────────────┐      │
│  │   scrape_sources    │ 1───*   │        scraped_items           │      │
│  ├─────────────────────┤         ├───────────────────────────────┤      │
│  │ id                  │         │ id                             │      │
│  │ name                │         │ sourceId (FK)                  │      │
│  │ baseUrl             │         │ sourceLabel                    │      │
│  │ noticeListUrl       │         │ category (enum, expanded)      │      │
│  │ newsListUrl         │         │ sourceSlug (NEW)               │      │
│  │ pressReleaseListUrl │         │ title                          │      │
│  │ noticeSchema (JSON) │         │ sourceUrl (unique)             │      │
│  │ newsSchema (JSON)   │         │ summary                        │      │
│  │ pressReleaseSchema  │         │ contentText                    │      │
│  │ paginationType      │         │ contentHtml                    │      │
│  │ paginationParam     │         │ attachmentUrl (legacy)         │      │
│  │ startPage           │         │ publishedAt                    │      │
│  │ maxPages            │         │ contentHash                    │      │
│  │ enabled             │         │ views                          │      │
│  │ lastRunAt           │         │ aiSummary (NEW: from crawl)    │      │
│  │ lastStatus          │         │ aiUrgency (NEW: LOW/MED/HIGH)  │      │
│  └─────────┬───────────┘         │ aiCategoryConfidence (NEW)     │      │
│            │                      │ keyFacts (JSON[])              │      │
│            │                      │ tags (JSON[])                  │      │
│            │                      │ metadata (NEW: JSON)           │      │
│            │                      │ aiAnalyzedAt                   │      │
│            │                      │ scrapedAt                      │      │
│            │                      └───────────────┬───────────────┘      │
│            │                                      │ 1───*                │
│            │ 1───*                ┌───────────────┴───────────────┐      │
│            │                      │      attachments (NEW)         │      │
│  ┌─────────┴───────────┐         ├───────────────────────────────┤      │
│  │    scrape_runs      │         │ id                             │      │
│  ├─────────────────────┤         │ itemId (FK)                    │      │
│  │ id                  │         │ url                            │      │
│  │ sourceId (FK)       │         │ mimeType                       │      │
│  │ sourceLabel         │         │ sizeBytes                      │      │
│  │ status (enum)       │         │ storageKey                     │      │
│  │ itemsFound          │         │ downloadedAt                   │      │
│  │ itemsNew            │         │ label                          │      │
│  │ itemsUpdated        │         └───────────────────────────────┘      │
│  │ itemsSkipped        │                                                │
│  │ itemsSummarized(NEW)│                                                │
│  │ itemsSummaryFailed  │                                                │
│  │ error               │                                                │
│  │ startedAt           │                                                │
│  │ finishedAt          │                                                │
│  └─────────────────────┘                                                │
│                                                                          │
│  Enums:                                                                  │
│  • ScrapedItemCategory: NOTICE | NEWS | PRESS_RELEASE | CIRCULAR |       │
│                          TENDER | VACANCY | OTHER                        │
│  • ScrapeRunStatus: RUNNING | SUCCESS | FAILED                           │
│  • ScrapePaginationType: QUERY_PARAM | PATH_TEMPLATE | NONE              │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Service Communication

```
┌────────────────┐       HTTP/REST        ┌────────────────┐
│   Next.js Web  │◄──────────────────────►│   NestJS API   │
│   :3000        │   JWT auth, admin role  │   :3001        │
└────────────────┘                         └───────┬────────┘
                                                   │
                                           HTTP (internal)
                                           AI_SERVICE_URL
                                                   │
                                           ┌───────▼────────┐
                                           │  Python AI     │
                                           │  (uvicorn)     │
                                           │  :8000         │
                                           └───────┬────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    │              │              │
                              ┌─────▼─────┐  ┌────▼─────┐  ┌────▼─────┐
                              │ crawl4ai  │  │ Groq API │  │Gemini API│
                              │(Playwright)│  │(LLM/chat)│  │(analysis)│
                              └─────┬─────┘  └──────────┘  └──────────┘
                                    │
                              ┌─────▼─────┐
                              │ Target    │
                              │ Websites  │
                              │ (gov.np)  │
                              └───────────┘
```

---

## Pre-Seeded Sources (10 Government Sites)

| # | Name | Domain | Categories |
|---|------|--------|------------|
| 1 | Ministry of Foreign Affairs | mofa.gov.np | Notice, News |
| 2 | Nepal Rastra Bank | nrb.org.np | Notice, News |
| 3 | Tribhuvan University | tu.edu.np | Notice |
| 4 | Kathmandu University | ku.edu.np | Notice, News |
| 5 | Ministry of Home Affairs | moha.gov.np | Notice, News, Press Release |
| 6 | Ministry of Education | moest.gov.np | Notice, News |
| 7 | Public Service Commission | psc.gov.np | Notice |
| 8 | Ministry of Finance | mof.gov.np | Notice, News, Press Release |
| 9 | Ministry of Health | mohp.gov.np | Notice, News |
| 10 | Office of the PM | opmcm.gov.np | Notice, News, Press Release |

---

## Progress Reporting

Real-time scraping progress is available via polling:

```
Admin Dashboard                    NestJS API                       Python AI Service
     │                                │                                   │
     │  GET /progress/:runId          │                                   │
     ├───────────────────────────────►│  GET /scrape/progress/:runId      │
     │                                ├──────────────────────────────────►│
     │                                │◄──────────────────────────────────┤
     │◄───────────────────────────────┤  { run_id, stage, messages[] }    │
     │                                │                                   │
```

**Progress messages** (examples):
- `"Resolving extraction pattern for Notice…"`
- `"Detected extraction pattern for Notice"`
- `"Crawling Notice listing, page 1…"`
- `"Fetching detail: Budget Speech 2083/84"`
- `"Notice page 1: 15 row(s) — 12 new, 3 already scraped"`
- `"All Notice items on page 2 are already scraped — stopping pagination early"`
- `"Scrape complete — 24 item(s) total"`

In-memory store with 15-min TTL, max 200 entries per run.

---

## Configuration

### Environment Variables

| Variable | Service | Purpose |
|----------|---------|---------|
| `AI_SERVICE_URL` | API | URL of the Python AI service (default: `http://localhost:8000`) |
| `GROQ_API_KEY` | AI | Enables LLM schema detection + notice analysis fallback |
| `GROQ_MODEL` | AI | Model for schema detection (default: `llama-3.3-70b-versatile`) |
| `GEMINI_API_KEY` | AI | Primary LLM for notice analysis |
| `SCRAPING_CONCURRENCY` | API | Reserved for future cron scheduler (default: 3) |
| `SCRAPING_INTERVAL_CRON` | API | Reserved cron expression (default: `0 6 * * *`) |

### Pagination Config (per-source, admin-configurable)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `paginationType` | enum | `QUERY_PARAM` | How page URLs are built |
| `paginationParam` | string | `"page"` | Query parameter name |
| `startPage` | int | `1` | First page number |
| `maxPages` | int | `3` | Max pages to crawl (hard limit: 20) |

---

## Error Handling & Resilience

| Scenario | Handling |
|----------|----------|
| Source already running | `ConflictException` — in-memory lock prevents duplicates |
| Source disabled | `ConflictException` — must be enabled to run |
| AI service unreachable | 10-min timeout → run fails, error stored |
| Schema detection fails | Category skipped, other categories continue |
| Detail page fetch fails | Item still created with listing-level data only |
| AI analysis fails | Warning logged, item saved without AI fields |
| Site changes markup | Cached schema yields 0 rows → auto re-detection |
| Duplicate content | `contentHash` comparison → SKIP |

---

## Key Design Decisions

1. **Dynamic schema detection** — No per-site scrapers. One generic engine handles any government website by auto-detecting the listing page structure.

2. **Tiered schema resolution** — Cached → LLM → Heuristic. Cached schemas make subsequent runs free of LLM costs. LLM is preferred over heuristics for initial detection because it reliably distinguishes main listings from sidebar "recent posts" widgets.

3. **Fire-and-forget execution** — The admin trigger returns immediately with a `runId`; the actual crawl runs asynchronously with progress polling.

4. **Early pagination stop** — Once an entire page consists of already-known URLs, deeper pages (which are older) are skipped entirely.

5. **Bikram Sambat support** — Nepal uses a dual calendar system; dates in Devanagari script are parsed and converted to Gregorian ISO strings.

6. **PDF viewer detection** — Sites that embed notices in pdf.js/DearFlip viewers have their toolbar chrome recognized and excluded from content; the actual PDF URL is extracted from inline JavaScript.

7. **Schema caching on success** — Working schemas are persisted back to the `ScrapeSource` row, so the next run is pure CSS extraction with zero LLM/heuristic cost.

8. **Concurrent AI summarization** — Summarization runs in parallel with crawling via asyncio tasks (semaphore-bounded to 4). By the time the crawl finishes, most items already have AI summaries.

9. **Dynamic slug-based categorization** — Items are categorized by their URL slug first (e.g. `/tender/...` → TENDER), with LLM fallback for ambiguous cases. The category enum is expanded to 7 types.

10. **Generic multi-attachment scanning** — Full detail page scan for all file-like links, stored in a separate `Attachment` model (one-to-many) with the original source URL always preserved as provenance.

11. **Metadata extraction** — Reference numbers and deadlines are extracted from content via regex when confidence is high; stored as flexible JSON rather than rigid columns.

---

## Future Enhancements (Not Yet Implemented)

| Feature | Status | Notes |
|---------|--------|-------|
| Cron scheduling | Reserved | `SCRAPING_INTERVAL_CRON` in .env, needs `@nestjs/schedule` |
| Concurrent source runs | Reserved | `SCRAPING_CONCURRENCY` in .env |
| Webhook notifications | Planned | Alert on new high-priority notices |
| Full-text search (Elasticsearch) | Planned | Currently using Prisma `contains` |
| PDF content extraction via OCR | Partial | Attachment URL captured; OCR pipeline exists separately |
| Attachment download to S3/local | Planned | `storageKey` column ready; download not yet wired |
| Admin category management UI | Planned | Enum expanded; admin CRUD for custom categories TBD |
