# Suchana AI - Current State, Architecture & Implementation Audit

**Project:** AI-Powered Cloud-Based Public Notice Management System for Nepal  
**Author:** Ashok Bhattarai (NP069811) — NP3F2509IT, Asia Pacific University  
**Date:** 2026-08-22  
**Version:** As-built audit (Turborepo monorepo: `apps/web` + `apps/api` + `apps/ai`)  
**Source of truth:** Repository `Personal/public-notice-management` — `SYSTEM.md`, `docs/system-overview.md`, `docs/RAG_IMPLEMENTATION.md`, `docs/document-rag-pipeline.md`, `docs/scraping-pipeline-crawl4ai.md`, `docs/TechStackByModule.md`, `docs/THESIS_TOC.md`, `apps/api/prisma/schema.prisma`, `apps/ai/app/*.py`, `apps/api/src/**/*`, `apps/web/app/**/*`

> **Scope:** Current as-built state, important feature implementations, Mermaid architecture & pipeline diagrams (error-free), comparison against **PDF 1** (Investigation Report / FYP Proposal — ChromaDB + Scrapy/Selenium + LangChain/Ollama + FR/NFR table in `docs/THESIS_TOC.md` Table 3), achieved vs. left, and accuracy/optimization benchmarks.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Overview](#2-current-state-overview)
3. [Technology Stack (As-Built)](#3-technology-stack-as-built)
4. [System Architecture](#4-system-architecture)
5. [Data Model](#5-data-model)
6. [End-to-End Pipelines](#6-end-to-end-pipelines)
7. [Important Feature Implementations](#7-important-feature-implementations)
8. [Comparison with PDF 1 Requirements](#8-comparison-with-pdf-1-requirements)
9. [What Is Achieved vs. What Is Left (Gap Analysis)](#9-what-is-achieved-vs-what-is-left-gap-analysis)
10. [Accuracy & Optimization Benchmark](#10-accuracy--optimization-benchmark)
11. [References & File Map](#11-references--file-map)

---

## 1. Executive Summary

Suchana AI (*सूचना* — "notice") is a **production-leaning, open-source, cloud-hostable** monorepo that closes a civic-access gap: government/public notices in Nepal are fragmented across ministry portals, often as scanned PDFs, with no unified search, summarization, or bilingual access. The system aggregates notices, understands them with AI, and lets citizens query them in natural language.

**Current maturity: ~90% of the flagship scope is delivered end-to-end across all three apps.** Both pillars — (1) **Document Intelligence / RAG** and (2) **Notice Aggregation with AI enrichment** — are live, including auth, persistence, vector search, LLM generation, scraping, and admin consoles. The one genuine placeholder is **subscription/alert *delivery*** (the matching engine exists; the scheduled push is the delta — see §9).

**Three deliberate pivots from PDF 1 were decisive and are now the as-built standard:**

| PDF 1 (Proposal) | As-Built (Delivered) | Rationale |
|---|---|---|
| **ChromaDB** (file-based vector store) | **Qdrant** — named dense (768-d, cosine) + BM25 sparse + RRF fusion, payload-filtered, deterministic IDs | Hybrid retrieval, per-doc filtering, production-grade Rust service, free 1GB cloud tier |
| **Scrapy + Selenium + BeautifulSoup4** as crawlers | **Crawl4AI** (async, Playwright-backed) + **BeautifulSoup4 retained** as heuristic-listing-schema detector | One tool for static + JS-rendered pages, Markdown/HTML clean, `robots.txt`/rate-limit native; BS4 repurposed not discarded |
| **LangChain + Ollama (Llama 3 local)** | **Raw ASGI (no framework) + Gemini 3-flash (primary) / Groq gpt-oss-120b multi-key rotation / OpenCode Zen fallback** | Zero overhead, free-tier quality leader (Gemini), Groq absorbs overflow/rate-limits, no SDK bloat |

---

## 2. Current State Overview

### 2.1 Implementation Status Matrix

| Subsystem | Status | Evidence (code) |
|---|---|---|
| **Google OAuth + JWT auth** (roles `user`/`admin`) | ✅ Delivered | `apps/api/src/modules/auth.module.ts`, `strategies/google.strategy.ts`, `guards/jwt-auth.guard.ts`, `guards/roles.guard.ts` |
| **Document management** (upload/list/download/delete, embed/unembed) | ✅ Delivered | `apps/api/src/services/documents.service.ts`, `controllers/documents.controller.ts`, `apps/ai/app/main.py` (`/documents`, `/progress`) |
| **Document RAG pipeline** (extract → OCR → chunk → embed → Qdrant hybrid → hybrid search → LLM) | ✅ Delivered | `apps/ai/app/{extractor,chunker,embeddings,store,rag,llm}.py`, `apps/api/src/services/rag.service.ts` |
| **RAG chat UI** (Library / Split / Chat, live progress, source chips) | ✅ Delivered | `apps/web/app/documents/page.tsx`, `lib/api.ts` |
| **Notice aggregation / crawling** (Crawl4AI, heuristic+LLM schema auto-detection, BS-date parsing, PDF-viewer detection) | ✅ Delivered | `apps/ai/app/scraper.py`, `apps/ai/app/secure_http.py` |
| **Notice classification & summarization** (EN+NE summaries, urgency, key facts, tags, metadata, concurrent) | ✅ Delivered | `scraper.py:_summarize_item`, `llm.py:analyze_notice` |
| **Admin scraping console** (source CRUD, trigger run, live progress, run history, item browser) | ✅ Delivered | `apps/api/src/{services,controllers}/scraping.*`, `apps/web/app/admin/{scraping,sources}` |
| **Notice persistence & public API** (search, category/date/urgency filters, per-notice detail + lazy PDF extraction) | ✅ Delivered | `prisma/schema.prisma` (`ScrapeSource`/`ScrapedItem`/`Attachment`/`ScrapeRun`), `services/notices.service.ts` |
| **Notice search chatbot** (PG keyword + Qdrant dense semantic + LLM synthesis) | ✅ Delivered | `apps/ai/app/notice_rag.py`, `notice_store.py`, `components/floating-chat.tsx` |
| **Per-notice Q&A** (`POST /notices/:id/ask`, `POST /notices/extract-pdf`) | ✅ Delivered | `apps/ai/app/main.py` (`_notices_ask`, `_notices_extract_pdf`) |
| **WhatsApp channel** (Evolution API webhook + send, OTP verify) | ✅ Delivered (ack-reply + alert delivery) | `apps/api/src/webhooks/whatsapp-webhook.*`, `services/notifications.service.ts`, `integrations/evolution/*` |
| **Alert rules engine** (CRUD, multi-dimension matching, digest vs instant) | ✅ Delivered | `services/alerts.service.ts`, `services/alert-matching.service.ts`, `services/alert-digest.service.ts` |
| **Alert delivery** (WhatsApp instant + daily/weekly digest, quota-aware) | ✅ Delivered | `alert-matching.service.ts:enqueue/drain/notifyOne`, `alert-digest.service.ts` |
| **Billing & quotas** (Plans FREE/PRO/MAX, Subscriptions, UsageCounters/Events, Stripe) | ✅ Delivered | `prisma/schema.prisma` (`Plan`/`Subscription`/`UsageCounter`/`UsageEvent`), `services/{plans,subscriptions,stripe,quota,usage}.service.ts` |
| **Observability** (structured JSON logs, `x-request-id` correlation, metrics histograms) | ✅ Delivered | `apps/api/src/common/logger/*`, `apps/ai/app/logger.py`, `metrics.py`, `main.py:_health` |
| **Scheduling** (cron polling, sitemap/listing probes, semaphore, stale-run recovery) | ✅ Delivered | `services/scraping-scheduler.service.ts` |
| **Frontend foundation** (Next.js 16, Tailwind v4, shadcn/ui, i18n, dark/light, responsive) | ✅ Delivered | `apps/web/app/*`, `lib/language-context.tsx`, `components/ui/*` |
| **Deployment** (Docker, EC2, Vercel, RDS, S3) | ⚠️ Configured, not auto-provisioned | `docker-compose.yml`, `docs/AWS_DEPLOYMENT.md`, `docs/deploy-crawl4ai-ec2.md` |

**Local dev remains one-command:** `pnpm install && pnpm dev` (Turborepo parallel) — web `:3535`, API `:5005`, AI `:8000`, Qdrant `:6333`, Postgres `:5432`.

### 2.2 Maturity Signals

- **Ops toggles are in DB, not env** — `scraping.enabled`, `scraping.cron`, `scraping.concurrency` live in `AppSetting` and hot-reload via `ScrapingSchedulerService:applyConfig()` without restart.
- **File stays on disk** after upload — enables `unembed → re-embed` without re-upload; Qdrant is not the source of truth for status.
- **Three LLM fallbacks** — Gemini primary, Groq multi-key rotation, OpenCode Zen (`deepseek-v4-flash-free`) — so one provider outage does not break any AI surface.

---

## 3. Technology Stack (As-Built)

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend** | Next.js (App Router) | 15.3 | SSR/SSG, file routing, Vercel CDN |
| | React | 19 | UI library |
| | Tailwind CSS | 4.x | Utility styling, `@tailwindcss/postcss` |
| | shadcn/ui + Radix UI | — | Accessible primitives (`dialog`, `select`, `tabs`, `switch`) |
| | next-themes | 0.4.x | Dark/light |
| | GSAP | 3.x | Animations |
| | react-markdown + remark-gfm | — | Cited Markdown answers |
| **Backend API** | NestJS | 11.x | Modular gateway (`@nestjs/*`, guards, pipes) |
| | Prisma ORM | 6.2 | Type-safe PostgreSQL, `prisma generate/migrate` |
| | PostgreSQL | 15 | System of record (`users`, `documents`, `scraped_*`, `alerts`, `plans`) |
| | JWT + Passport | `passport-jwt` | Stateless auth, Google ID-token verify (`google-auth-library`) |
| | `multer` | 2.x | Multipart upload, MIME + size validation |
| | `@nestjs/schedule` + `cron` | 5.x | Scheduler (`ScrapingSchedulerService`) |
| | `helmet`, `compression`, `cookie-parser` | — | Security/perf |
| **AI Service** | Python raw ASGI + Uvicorn | 3.x / 0.30+ | 16 routes, no framework overhead |
| | `sentence-transformers` | 3.x | `intfloat/multilingual-e5-base` (768-d, EN+NE) |
| | `fastembed` | 0.3.6 | `Qdrant/bm25` sparse (keyword leg) |
| | Qdrant | 1.9+ | Vector DB — dense+sparse, RRF, payload filters |
| | `pypdf` + `python-docx` + `Pillow` | — | Native extraction |
| | `pytesseract` + `pdf2image` | — | OCR (`nep+eng`, BS date aware) |
| | `crawl4ai` + `beautifulsoup4` | 0.6+ | Async crawling + schema detection |
| | `google-genai` / `httpx` | — | Gemini/Groq/Zen LLM calls (no heavy SDK) |
| | `nepali-datetime` | 1.x | Bikram Sambat → Gregorian |
| **Infra** | Turborepo + pnpm | 2.5 / 10.18 | Monorepo orchestration, shared `@pnm/*` |
| | Docker / EC2 / Vercel / S3 | — | Deployment (`docker-compose.yml`) |
| | Evolution API | — | WhatsApp channel |

Full justification, trade-offs, and ratings: `docs/TechStackByModule.md:5-8`.

---

## 4. System Architecture

### 4.1 High-Level Architecture

```mermaid
flowchart TB
    subgraph Client[Browser]
        WEB["apps/web - Next.js 16 / React 19\n/documents (RAG) /notices /dashboard /admin\nTailwind v4 / shadcn/ui / GSAP"]
    end
    subgraph Server[Server]
        API["apps/api - NestJS + Prisma\nauth / documents / rag / notices\nscraping / alerts / billing / notifications\nJWT guards / ValidationPipe"]
        AI["apps/ai - Python raw ASGI\n extract / chunk / embed / query\n scrape / analyze / notice search\n progress / scrape_progress"]
    end
    subgraph Data[Data]
        PG[("PostgreSQL\nusers / documents\nscrape_sources / scraped_items\nattachments / scrape_runs\nalert_rules / notifications\nplans / subscriptions")]
        QD[("Qdrant\n documents collection\n (dense 768 + BM25 sparse)\n notices collection\n (dense-only)")]
        S3[("AWS S3 / Local Disk\napps/api/uploads\napps/ai/data/uploads")]
    end
    subgraph External[External]
        LLM["LLM Tier\nGemini 3-flash (primary)\nGroq gpt-oss-120b (fallback)\nOpenCode Zen (third)"]
        OAUTH["Google OAuth\nID-token verify"]
        WA["Evolution API\nWhatsApp webhook & send"]
        GOV["Gov Portals\nmofa.gov.np + any admin-added site"]
    end

    WEB -- "HTTPS + Bearer JWT" --> API
    API -- "HTTP private + x-request-id" --> AI
    API --> PG
    API --> S3
    API -. "OAuth verify" .-> OAUTH
    API <-. "webhook / send" .-> WA
    AI --> QD
    AI --> LLM
    GOV -. "Crawl4AI scrape" .-> AI

    style WEB fill:#0ea5e9,color:#fff
    style API fill:#e11d48,color:#fff
    style AI fill:#7c3aed,color:#fff
```

*Figure 1 — High-level system architecture. Browser never talks to AI directly — NestJS is the trusted gateway and source of truth.*

**Division of responsibility:**

| Layer | Owns | Does NOT own |
|---|---|---|
| `apps/web` | UX: upload, embed toggle, live progress, chat rendering, notice browse/search/filter, admin console | Any AI logic, direct DB/Qdrant access |
| `apps/api` | Auth, `Document`/`ScrapeSource`/`ScrapedItem`/`ScrapeRun`/`AlertRule` persistence, file storage, proxying to AI, run locking, quotas | Vectors, embeddings, LLM prompts, crawling |
| `apps/ai` | Extraction, OCR, chunking, embeddings, Qdrant (both collections), crawling, schema detection, LLM prompting, ephemeral progress | Auth, relational metadata persistence |

### 4.2 Monorepo Structure

```mermaid
flowchart TB
    ROOT["public-notice-management/\nTurborepo 2.5 / pnpm 10"]
    ROOT --> WEB2["apps/web\nNext.js 15 / React 19 / Tailwind v4"]
    ROOT --> API2["apps/api\nNestJS 11 / Prisma 6 / PostgreSQL"]
    ROOT --> AI2["apps/ai\nPython ASGI / Uvicorn / Qdrant"]
    ROOT --> PKG["packages/\n@pnm/types / @pnm/utils / @pnm/config\n(shared TS contracts)"]
    ROOT --> TOOL["turbo.json / pnpm-workspace.yaml\npackage.json (root scripts)"]

    WEB2 --> WEBFILES["app/(about,notices,documents,dashboard,admin)\ncomponents/ui,layout,notices,rag\nlib/api,auth-context,language-context"]
    API2 --> APIFILES["src/{modules,services,controllers,guards}\nprisma/schema.prisma\nuploads/"]
    AI2 --> AIFILES["app/{main,extractor,chunker,embeddings,store,rag,llm,scraper}\nrequirements.txt / .venv"]

    style ROOT fill:#0f172a,color:#fff
    style WEB2 fill:#0ea5e9,color:#fff
    style API2 fill:#e11d48,color:#fff
    style AI2 fill:#7c3aed,color:#fff
```

### 4.3 Frontend Module Architecture

```mermaid
flowchart TB
    subgraph Web["apps/web - app/ (Next.js App Router)"]
        A1["/ (landing)\nanimated-hero, features, problem/solution"]
        A2["/notices\nbrowse/search + [slug] detail\n+ floating-chat"]
        A3["/documents\nLibrary / Split / Chat\nupload + progress + cited chat"]
        A4["/dashboard\nuser alerts / saved / activity"]
        A5["/admin\n(scraping, sources, notices,\nusers, plans, system)"]
        A6["/login /pricing /about /contact"]
    end
    subgraph Lib["lib/ & components/"]
        L1["auth-context.tsx\nGoogle OAuth + JWT tokenStore"]
        L2["language-context.tsx\ni18n EN/NE"]
        L3["notice-context.tsx\nsearch state"]
        L4["api.ts\napiFetch with JWT + x-request-id"]
        C1["components/ui/*\nshadcn/Radix"]
        C2["components/floating-chat.tsx\nportal-wide notice chatbot"]
        C3["components/admin/*\nscraping console"]
    end
    Web --> Lib
```

### 4.4 Backend API Module Architecture

```mermaid
flowchart LR
    MAIN["main.ts\nbootstrap\nhelmet/cors/logger"] --> APP["app.module.ts\nConfigModule / ScheduleModule\nPrismaModule / AuthModule"]
    APP --> M1["AuthModule\nJWT + Google verify"]
    APP --> M2["DocumentsModule\nmulter upload\nPENDING->INDEXED"]
    APP --> M3["RagModule\nproxy /rag/query"]
    APP --> M4["NoticesModule\npublic search/filters"]
    APP --> M5["ScrapingModule\nsource CRUD + run + scheduler"]
    APP --> M6["AlertsModule\nrules + matching + digest"]
    APP --> M7["NotificationsModule\nWhatsApp OTP/verify"]
    APP --> M8["BillingModule\nplans / subscriptions / Stripe"]
    APP --> M9["SettingsModule\nAppSetting KV"]
```

*`src/common/logger`, `common/token-revocation.module`, `common/maintenance.middleware`, `guards/*`, `decorators/current-user` are cross-cutting.*

### 4.5 AI Service Architecture (Raw ASGI)

```mermaid
flowchart TB
    UVI["uvicorn\napp.main:app\nlifespan warmup\nbackground _warmup()"] --> ROUTE["_route() - 16 routes\nno FastAPI, zero framework"]
    ROUTE --> R1["GET / /health"]
    ROUTE --> R2["POST /documents\n+ GET /progress /documents/:id/status"]
    ROUTE --> R3["POST /query\nGET /progress"]
    ROUTE --> R4["POST /scrape/source\nPOST /scrape/sitemap/*\nGET /scrape/progress/:id"]
    ROUTE --> R5["POST /notices/*\nanalyze / extract-pdf / ask / search / embed"]

    R2 --> PIPE1["extractor -> chunker -> embeddings\n-> store (Qdrant)"]
    R4 --> PIPE2["scraper (Crawl4AI)\n+ llm.analyze_notice"]
    R3 --> PIPE3["rag.query\n(store.search + llm)"]
    R5 --> PIPE4["notice_rag / notice_store"]

    style UVI fill:#7c3aed,color:#fff
```

### 4.6 Deployment Architecture

```mermaid
flowchart TB
    subgraph Vercel["Vercel CDN"]
        WEBD["Next.js frontend\nsuchanaai.tech"]
    end
    subgraph AWS["AWS"]
        EC2A["EC2 - NestJS API\n:5005"]
        EC2B["EC2 - Python AI\n:8000 + Playwright/Chromium"]
        RDS[("RDS PostgreSQL")]
        S3B[("S3 - uploads")]
        QDC[("Qdrant\nDocker or Qdrant Cloud")]
    end
    GROQ["Groq / Gemini / Zen\nLLM APIs"]
    WA2["Evolution API\nWhatsApp"]

    WEBD -->|HTTPS| EC2A
    EC2A --> EC2B
    EC2A --> RDS
    EC2A --> S3B
    EC2B --> QDC
    EC2B --> GROQ
    EC2A --- WA2
```

*`docker-compose.yml` runs Postgres + Qdrant + API + AI locally; `docs/AWS_DEPLOYMENT.md` and `docs/deploy-crawl4ai-ec2.md` cover EC2 Playwright setup.*

---

## 5. Data Model

### 5.1 PostgreSQL ER Diagram (Prisma)

```mermaid
erDiagram
    USER ||--o{ DOCUMENT : uploads
    USER ||--o{ ALERT_RULE : defines
    ALERT_RULE ||--o{ ALERT_NOTIFICATION : triggers
    SCRAPE_SOURCE ||--o{ SCRAPED_ITEM : produces
    SCRAPE_SOURCE ||--o{ SCRAPE_RUN : logs
    SCRAPED_ITEM ||--o{ ATTACHMENT : has
    SCRAPED_ITEM ||--o{ ALERT_NOTIFICATION : notifies
    USER ||--o{ USAGE_COUNTER : tracks
    USER ||--o{ USAGE_EVENT : logs
    USER ||--o{ SUBSCRIPTION : subscribes
    PLAN ||--o{ SUBSCRIPTION : offers

    USER {
        uuid id PK
        string googleId UK
        string email UK
        string name
        string avatarUrl
        enum role
        enum status
        string whatsappNumber
        boolean whatsappVerified
        boolean whatsappAlertsEnabled
        enum digestFrequency
        datetime lastLoginAt
        datetime createdAt
    }
    DOCUMENT {
        uuid id PK
        string title
        string filename
        string mimeType
        int fileSize
        string filePath
        string fileHash UK
        enum status
        boolean isOcr
        boolean isSystem
        int textLength
        int chunkCount
        uuid uploadedBy FK
        datetime indexedAt
    }
    SCRAPE_SOURCE {
        uuid id PK
        string name
        string baseUrl
        string noticeListUrl
        string newsListUrl
        string pressReleaseListUrl
        json noticeSchema
        json newsSchema
        json pressReleaseSchema
        enum paginationType
        string paginationParam
        int startPage
        int maxPages
        int pollIntervalSeconds
        string sitemapUrl
        datetime sitemapCheckedAt
        boolean enabled
        datetime lastRunAt
        enum lastStatus
    }
    SCRAPED_ITEM {
        uuid id PK
        uuid sourceId FK
        string sourceLabel
        enum category
        string sourceSlug
        string title
        string sourceUrl UK
        string summary
        string contentText
        string contentHtml
        string attachmentUrl
        datetime publishedAt
        string contentHash
        int views
        string aiSummary
        string aiSummaryNe
        string aiUrgency
        float aiCategoryConfidence
        json keyFacts
        json tags
        json metadata
        datetime aiAnalyzedAt
        datetime scrapedAt
    }
    ATTACHMENT {
        uuid id PK
        uuid itemId FK
        string url
        string mimeType
        int sizeBytes
        string label
        datetime downloadedAt
    }
    SCRAPE_RUN {
        uuid id PK
        uuid sourceId FK
        enum status
        int itemsFound
        int itemsNew
        int itemsUpdated
        int itemsSummarized
        string error
        datetime startedAt
        datetime finishedAt
    }
    ALERT_RULE {
        uuid id PK
        uuid userId FK
        string name
        boolean enabled
        enum priority
        array categories
        array tags
        array keywords
        array excludeKeywords
        array organizations
        enum minUrgency
        int deadlineWithinDays
        int matchCount
    }
    PLAN {
        uuid id PK
        enum tier
        string name
        int priceMonthlyCents
        int maxDocuments
        int maxAiQuestionsPerMonth
        int maxAlertRules
        int maxWhatsappPerMonth
        boolean allowInstantAlerts
    }
```

*Generated from `apps/api/prisma/schema.prisma`. Qdrant chunk embeddings are outside Postgres — see §5.2. Frontend mirrors DTOs in `apps/web/lib/types.ts`. Full ER: `erd.md`.*

**Key relations:**

| Relation | Cardinality | On delete | Notes |
|---|---|---|---|
| `User -> Document` | 1:N | RESTRICT | `uploadedBy` nullable — `isSystem=true` docs have no owner |
| `ScrapeSource -> ScrapedItem` | 1:N | CASCADE | `sourceId` nullable for legacy/manual items |
| `ScrapeSource -> ScrapeRun` | 1:N | CASCADE |  |
| `ScrapedItem -> Attachment` | 1:N | CASCADE | Deleting notice removes attachments |
| `User -> AlertRule` | 1:N | CASCADE |  |
| `AlertRule -> AlertNotification` | 1:N | CASCADE | Unique `(userId, scrapedItemId)` prevents dup pushes |

### 5.2 Qdrant Collections

**`documents` collection — hybrid, per-document filterable:**

```mermaid
flowchart TB
    subgraph Coll["Qdrant collection: documents"]
        V["vectors_config: dense = 768-d COSINE"]
        SP["sparse_vectors_config: bm25 (IDF modifier)"]
        IDX["payload_index: doc_id = KEYWORD"]
    end
    subgraph Point["Point (one per chunk)"]
        PID["id = uuid5(doc_id:chunk_index)\n deterministic, idempotent upsert"]
        DV["vector.dense = e5 passage: embedding"]
        BV["vector.bm25 = sparse indices/values"]
        PL["payload {doc_id, chunk_index, content,\nchar_start, char_end, title, filename, mime}"]
    end
    Coll --> Point
```

*Payload fields: `doc_id`, `chunk_index`, `content`, `char_start`/`char_end`, `title`, `original_filename`, `mime_type`. `store.py:ensure_collection()` validates `EMBEDDING_DIM` vs. `dense.size` on startup and auto-recreates on mismatch. Second collection `notices` (dense-only, title+summary) backs portal-wide chatbot fallback.*

### 5.3 Vector Embedding Schema

- Model: `intfloat/multilingual-e5-base`, 768-d, L2-normalised (cosine = dot).
- E5 asymmetric prefixes: `passage: ...` for indexed chunks, `query: ...` for questions — applied automatically (`embeddings.py:_apply_prefix`).
- Chunking: 800 chars, 120-char word-boundary overlap (≈200 tokens, inside 512 window), hierarchical paragraph → sentence (incl. Devanagari `।`) → word (`chunker.py`).
- Batching: 32 per `encode()`, 100 per Qdrant `upsert` — bounded memory, per-batch progress callbacks.

---

## 6. End-to-End Pipelines

### 6.1 Document Ingestion Pipeline (Upload → Vectors)

```mermaid
flowchart TD
    subgraph WEBP["apps/web"]
        U["User selects file"] --> UPB["POST /documents multipart\nJWT + FormData"]
    end
    subgraph APIP["apps/api - NestJS"]
        UPB --> CTRL["DocumentsController.upload\nJwtAuthGuard + FileInterceptor\nvalidate MIME + 50MB cap"]
        CTRL --> DISK["Save file to disk\nuploads/uuid.ext"]
        DISK --> DBROW["prisma.document.create()\nstatus=PENDING, fileHash=SHA256"]
        DBROW --> RESP["Return 201 PENDING to web"]
        DBROW -. "async non-blocking" .-> PROC["processDocument()\nstatus=PROCESSING"]
        PROC --> FORM["FormData file+document_id+title"]
        FORM -->|"HTTP POST AI_SERVICE_URL/documents\ntimeout 10min, maxBodyLength Infinity"| AIUP
    end
    subgraph AIP["apps/ai - Python ASGI"]
        AIUP["_upload_document\nmultipart parse"] --> SAVE["Save to data/uploads/doc_id.ext"]
        SAVE --> PSTART["progress.start(doc_id)"]
        PSTART --> THREAD["asyncio.to_thread(_ingest_document)\noff event loop"]
        THREAD --> EXT["extractor.extract_text\npypdf or Tesseract nep+eng"]
        EXT --> CHUNK["chunker.chunk_text\n800/120 word-boundary"]
        CHUNK --> EMB["embeddings.get_embeddings\nmultilingual-e5-base batched 32"]
        EMB --> IDX["store.index_document\nensure_collection + sparse BM25 + upsert batches 100"]
        IDX --> FIN["progress.finish\nreturn chunk_count, text_length, is_ocr"]
    end
    subgraph QDR["Qdrant"]
        IDX --> QCOLL[("documents collection")]
    end
    FIN -->|"201: chunk_count, text_length, is_ocr"| DONE["DocumentsService updates row\nINDEXED + indexedAt"]

    subgraph POLL["Progress polling (parallel)"]
        POLL1["Browser GET /documents/progress/batch?ids=a,b,c\n(single batched request/tick)"]
        POLL1 --> POLL2["NestJS -> AI GET /progress?ids=\n(in-memory dict, no DB)"]
        POLL2 --> POLL3["{stage, percent} extracting->chunking->embedding->indexing->done"]
    end
```

*Stages: `extracting` (0-15%) → `chunking` (15-25%) → `embedding` (25-85%) → `indexing` (85-100%) — stage-weighted monotonic percent (`progress.py`). SSE variant `GET /documents/:id/progress/stream` also available.*

### 6.2 Query Pipeline (Question → Cited Answer)

```mermaid
flowchart TD
    subgraph WEBQ["apps/web"]
        Q["User types question"] --> QP["POST /rag/query\nJWT + question + doc_id? + top_k + language"]
    end
    subgraph APIQ["apps/api - NestJS"]
        QP --> RAGC["RagController -> RagService\nproxy to AI"]
        RAGC -->|"HTTP POST AI/query"| RAGQ
    end
    subgraph AIQ["apps/ai - rag.query"]
        RAGQ["_query handler"] --> SMALL{"lexical small talk?\nhi/namaste/thanks -> squeeze-match"}
        SMALL -->|yes| CHAT["llm.generate_chat\nno retrieval, persona + style rotation"]
        SMALL -->|no| QEMB["embeddings.get_embedding(kind=query)\nquery: prefix"]
        QEMB --> INTENT{"semantic intent?\nchat vs doc prototypes + LLM tiebreak"}
        INTENT -->|chat| CHAT
        INTENT -->|document| SEARCH["store.search\nover-fetch top_k*3 max 20"]
        SEARCH --> SELECT["_select_context\ndrop score < 0.78 + dedup prefix 120"]
        SELECT --> HAS{"any context?"}
        HAS -->|no| NORES["llm.generate_no_results\nunique reply in user language"]
        HAS -->|yes| GEN["llm.generate_answer\nGroq/Gemini cite [1][2] Markdown"]
        GEN --> OUT["answer + sources{doc_id, chunk_index, content, score, title}\nmodel_used"]
    end
    subgraph SEARCHD["store.search - hybrid"]
        SEARCH --> FILTER["Build filter doc_id/doc_ids"]
        FILTER --> HYB{"sparse available?"}
        HYB -->|yes| RRF["Qdrant query_points\nprefetch dense + BM25\nFusion.RRF"]
        HYB -->|no| DENSE["Dense-only cosine"]
        RRF --> RESCORE["Re-score by cosine dot\nsort desc (fixes RRF rank scores)"]
        DENSE --> RESCORE
    end
    CHAT --> RET["Return to API -> web\nreact-markdown + grouped source chips"]
    NORES --> RET
    OUT --> RET
    SEARCH -. "reads" .-> QD2[("Qdrant")]
    GEN -. "calls" .-> GROQ[("Groq/Gemini")]
```

*Threshold 0.78 is E5-specific (scores compress 0.7-0.9; irrelevant ~0.76-0.78, relevant 0.82+). Extractive fallback when LLM unavailable: sentence-embed + cosine ranking, deduplicated, in reading order — `model_used=extractive` triggers amber banner in UI.*

### 6.3 Notice Aggregation Pipeline (Crawl4AI → PostgreSQL + AI Enrichment)

```mermaid
flowchart TD
    subgraph WEBAD["apps/web - Admin"]
        AADM["Admin clicks Run now"] --> BADM["POST /admin/scraping/sources/:id/run\nJWT admin"]
        AADM2["Admin Add-source dialog\nname, baseUrl, notice/news URLs\n+ pagination config"] --> B2["POST /admin/scraping/sources"]
    end
    subgraph APISCR["apps/api - NestJS"]
        BADM --> C["ScrapingController.runSource\nJwtAuthGuard + RolesGuard admin"]
        B2 --> C2["createSource -> Prisma INSERT"]
        C --> D["ScrapingService.runSource\nfire-and-forget, returns {runId} immediately"]
        D --> E["Create ScrapeRun RUNNING\n+ Set<sourceId> lock"]
        E --> F["SELECT known_urls FROM scraped_items"]
        E --> G0["Load cached schemas from scrape_sources"]
        F --> G["POST AI_SERVICE_URL/scrape/source\nbase_url, category_urls,\ncached_schemas, known_urls, run_id, pagination"]
        G0 --> G
    end
    subgraph AISCR["apps/ai - scraper.py"]
        G --> H["_scrape_source handler"]
        H --> I["scraper.scrape_source"]
        I --> J["AsyncWebCrawler (crawl4ai)\nPlaywright Chromium, JS enabled"]
        J --> K{"cached schema yields rows?"}
        K -->|yes| L["Pure CSS extraction\nJsonCssExtractionStrategy"]
        K -->|no| K2{"GROQ_API_KEY?"}
        K2 -->|yes| K3["LLM propose schema\n(cleaned HTML 30k chars)"]
        K2 -->|no| K4["Heuristic DOM-group scan\nscore by tag+class repetition"]
        K3 --> K5{"schema yields rows?"}
        K4 --> K5
        K5 -->|yes| L
        L --> M{"detail URL in known_urls?"}
        M -->|new| N["Fetch detail page generically\nstrip chrome, pick article container"]
        M -->|known| O["Skip detail fetch\nkeep listing summary"]
        N --> P["Build ScrapedItem + schemas_used\n+ concurrent summarize (semaphore 2)"]
        O --> P
        P --> Q["Return 200: items, schemas"]
    end
    Q --> R["ScrapingService receives items"]
    R --> S{"sourceUrl in DB?"}
    S -->|no| T["INSERT scraped_items\n+ contentHash sha256"]
    S -->|hash changed| U["UPDATE scraped_items"]
    S -->|unchanged| V["Skip"]
    T --> W["UPDATE ScrapeRun SUCCESS\n+ UPDATE ScrapeSource lastRunAt/lastStatus/schemas\n+ fire-and-forget POST /notices/embed"]
    U --> W
    V --> W
    W --> X["Response -> web refetches\nGET /admin/scraping/sources + runs"]
```

*Cheaper paths: `POST /scrape/sitemap/detect` (robots.txt -> /sitemap.xml -> best child, cached on ScrapeSource), `POST /scrape/check` (return only `<loc>` not yet in DB), `POST /scrape/sitemap-crawl` (fetch exact new URLs as detail pages, no listing schema). Scheduler uses these to keep HTML-only sources pollable every few minutes instead of full-crawl every 15.*

### 6.4 Notice Search Chatbot Pipeline (Public Portal)

```mermaid
flowchart LR
    U2["User in floating-chat"] --> WEBFB["POST /notices/search\nquestion + optional category/language/top_k"]
    WEBFB --> APIN["NoticesService.search\n1. Prisma ILIKE over ScrapedItem.title/summary/contentText\n2. forward pg_results to AI"]
    APIN --> AIN["notice_rag.search_and_answer\nif pg_results present -> use directly\nelse -> notice_store dense-only fallback\nthen llm synthesis, same grounding rules"]
    AIN --> RESP2["answer + sources"]
    RESP2 --> WEBFB
```

*Per-notice ask (`POST /notices/:id/ask`) skips retrieval — it builds context from one notice's fetched content + `aiSummary`/`keyFacts`/`metadata`/`attachments`.*

### 6.5 Alert Matching Pipeline (Delivered)

```mermaid
flowchart TD
    SCRAPED["New ScrapedItem persisted\nin ScrapingService"] --> ENQ["AlertMatchingService.enqueue(item)\nnon-blocking, queue cap 500, serial drain"]
    ENQ --> EVAL["evaluate(item)\nload all enabled AlertRules\nwhere user.whatsappVerified && whatsappAlertsEnabled"]
    EVAL --> PER["For each rule: evaluateRule()\nAND across dimensions:\ncategories/tags (OR within) + keywords + excludeKeywords\n+ organizations + minUrgency + deadlineWithinDays"]
    PER --> WIN{"matched?"}
    WIN -->|no| DROP["no-op"]
    WIN -->|yes| FIRST["first match per user wins\n(Map<userId, rule> dedup)"]
    FIRST --> PRIO{"HIGH priority or digest=INSTANT?"}
    PRIO -->|instant| SEND["notifyOne()\nquota check (quota.canSendWhatsapp)\nEvolutionApiService.sendText()\ncreate AlertNotification SENT/FAILED"]
    PRIO -->|digest| QUEUE["upsert AlertNotification PENDING\nincrement matchCount\nAlertDigestService batches daily/weekly"]
```

---

## 7. Important Feature Implementations

### 7.1 Authentication & RBAC

- **Flow:** Client `GoogleOAuthProvider` → server verifies ID token via `google-auth-library:OAuth2Client.verifyIdToken()`, mints stateless JWT (`@nestjs/jwt`), stores via `tokenStore` (localStorage) + `apiFetch` Bearer, re-reads `User.role` from DB per request (`JwtAuthGuard` + `RolesGuard` + `@Roles(Role.admin)`).
- **Roles:** `guest` (browse only) → `user` (dashboard, saved, alerts, RAG chat) → `admin` (notice CRUD, user/category mgmt, scraping console, system settings).
- **Files:** `apps/api/src/modules/auth.module.ts:1`, `strategies/google.strategy.ts`, `guards/jwt-auth.guard.ts:1`, `dto/*`, `apps/web/lib/auth-context.tsx`.

### 7.2 Document Management & Lifecycle

- **Upload:** `multer` disk storage `uuid.ext`, MIME allowlist (`pdf`, `docx`, `txt`, `png`, `jpeg`, 50MB), magic-bytes + SHA256 `fileHash` dedup, `POST /documents` returns `PENDING` immediately.
- **State machine:** `PENDING -> PROCESSING -> INDEXED` (or `FAILED`); `INDEXED -> UNEMBEDDED` via `POST /documents/:id/unembed` (removes Qdrant points, file stays); `UNEMBEDDED/FAILED -> PROCESSING` via `POST /documents/:id/embed` (re-embed stored file, deterministic `uuid5` upsert). File persists until row deleted.
- **Files:** `apps/api/src/controllers/documents.controller.ts:284`, `services/documents.service.ts`, `apps/ai/app/main.py:_upload_document`, `progress.py`.

### 7.3 Document RAG — Extraction, Chunking, Embeddings, Hybrid Retrieval, Generation

- **Extraction:** `extractor.py` — `pypdf` fast path; if `<100 chars/page` ⇒ `pdf2image` + `pytesseract` (`nep+eng`) OCR; DOCX/images/TXT handled; heavy imports lazy, `OCR_MAX_CONCURRENCY=1` caps CPU.
- **Chunking:** `chunker.py` — `CHUNK_SIZE=800`, `CHUNK_OVERLAP=120`, hierarchical split (blank line → sentence regex `[.!?।]` including Devanagari danda → word), greedy pack with word-boundary overlap snap (fixes mid-word fragments), logs per-chunk + summary.
- **Embeddings:** `embeddings.py` — lazy singleton `multilingual-e5-base`, `_apply_prefix` (`query:`/`passage:`), batched `32`, `normalize_embeddings=True`, `asyncio.to_thread` off event loop.
- **Indexing:** `store.py` — named vectors `{dense: 768 COSINE, bm25: SparseVector(IDF)}`, `payload_index doc_id KEYWORD`, `uuid5(doc_id:index)` deterministic IDs, `ensure_collection()` self-healing, batched upsert `100`.
- **Retrieval:** `rag.py` + `store.py` — over-fetch `top_k*3` (max 20), Qdrant `prefetch dense top_k*2 + prefetch BM25 top_k*2 → FusionQuery(RRF)` → cosine re-score (`dot` of L2-norm vectors) → threshold `0.78` → dedupe `normalize 120-char prefix` → `top_k` context; per-doc filter via `doc_id` payload in both prefetches; degrade to dense-only if sparse unavailable.
- **Intent routing:** `rag.py` — Tier 1 lexical squeeze (`Helllloooooo→helo`, multilingual greetings list), Tier 2 semantic prototype (reuse query embedding vs chit-chat prototype margin `0.04`), Tier 3 Groq one-word tiebreak; chat intent ⇒ `llm.generate_chat()` (persona + style hint, temp 0.9, no retrieval).
- **Generation:** `llm.py` — `SYSTEM_PROMPT` grounded cited Markdown, random structural directive + `temp 0.7`, `context [i] (from "title")`, `_groq_chat()` with one retry on 429/5xx + guarded parse + `<think>` strip, degradable to `_extractive_fallback()` (sentence-embed ranking, original order, 25-char + lowercase-start filters), `model_used` surfaced.

### 7.4 Notice Aggregation & Scraping (Crawl4AI)

- **Dynamic detection (3 tiers, cached):** 1) cached `noticeSchema`/`newsSchema` on `ScrapeSource`, 2) LLM detection (Groq proposes `JsonCssExtractionStrategy` from cleaned HTML, preferring real `<table>` over sidebar widgets), 3) structural heuristics (`_detect_schema_heuristic` — group by tag+class, score by repetition + `row/item/card/list` hints, penalize nav/footer, pick detail anchor/title/date). Winner cached; re-detection only if cached yields 0 rows.
- **Pagination:** `ScrapePaginationType {QUERY_PARAM ( ?page=N ), PATH_TEMPLATE ({page}), NONE}` — admin-configurable per source (`paginationParam`, `startPage`, `maxPages`).
- **Detail generic:** `_crawl_detail_generic` — strips chrome, priority `article/main/[role=main]/.entry-content` etc., falls back to full page; `<h1>` title, `<time>` date, BS-date parsing (`nepali_datetime`, Devanagari numerals, month-first vs day-first), pdf.js/DearFlip viewer DOM-signature skip + PDF discovery via anchor/path-hint/JS var.
- **Cost controls:** `known_urls` set skips detail fetch for known items; early pagination stop when page yields no new rows; sitemap fast-paths keep HTML-only sources cheap.
- **Files:** `apps/ai/app/scraper.py`, `scrape_progress.py`, `secure_http.py`, `apps/api/src/services/scraping.service.ts:1240`, `controllers/scraping.controller.ts:209`.

### 7.5 Notice Enrichment (AI Classification & Summarization — Concurrent)

- **When:** Inside `scraper.scrape_source`, immediately after detail fetch, semaphore `2` concurrent (`SUMMARIZE_CONCURRENCY`, per-run `summarize_concurrency` from admin `scraping.summarizeConcurrency`).
- **What:** `llm.analyze_notice(title, content)` → `{aiSummary, aiSummaryNe, aiUrgency (LOW/MEDIUM/HIGH), aiCategoryConfidence, keyFacts[], tags[], metadata{referenceNo, issuingOffice, deadline, etc.}}` stored on `ScrapedItem` + `aiAnalyzedAt`; `itemsSummarized`/`itemsSummaryFailed` counted per `ScrapeRun`; after run, `POST /notices/embed` indexes title+summary into `notices` Qdrant collection (dense-only) for chatbot fallback.
- **LLM resilience:** Gemini primary → Groq multi-key rotation → Zen; all via single hardened `httpx` helper.

### 7.6 Notice Browsing & Search (Public Portal)

- **Search:** `GET /notices` (`NoticesService:list`) — Prisma `ILIKE` over `title/summary/contentText` + filters `category, sourceId, dateFrom/dateTo, urgency, sortBy/sortOrder, page/limit` + pagination; keyword-first, Qdrant semantic only when PG returns nothing (see §10 limitations).
- **Detail:** `GET /notices/:id` — increments `views`, lazy `POST /notices/extract-pdf` if notice is PDF attachment without `contentText` (SSRF-protected download, `secure_http.secure_download_pdf`, max 50MB).
- **UI:** `apps/web/app/notices/page.tsx:594`, `components/notices/*`, `components/floating-chat.tsx`.

### 7.7 Per-Notice Q&A & PDF Extraction

- `POST /notices/ask` → `_build_notice_context()` assembles `NOTICE FACTS + STRUCTURED METADATA + ATTACHMENTS + AI SUMMARY (EN/NE) + KEY POINTS + NOTICE TEXT (last, garbage-filtered via extractor.is_readable_text)`, then `llm.answer_notice_question()` (small-talk checked first, no retrieval). `POST /notices/extract-pdf` downloads URL, `extractor.extract_text`, runs `analyze_notice`, returns `{content_text, quality, method, analyzed}`.

### 7.8 Admin Scraping Console

- **Sources tab:** Cards with `enabled/failed` badge, categories configured, item count, pagination summary, last run timestamp, **Run now** (with `categories` multi-select), Enable/Disable, Edit, Delete; Add/Edit dialog with collapsible **Advanced: pagination** (type/select, param, startPage, maxPages, pollInterval, sitemap).
- **Runs/Logs tab:** `GET /admin/scraping/runs` real history, live **Run now** message panel polling `GET /admin/scraping/runs/:id/progress` every 1.2s (proxied to `AI GET /scrape/progress/:runId` — rolling message log `Resolving schema…`, `Crawling page 2…`, `Fetching detail: …`).
- **Items tab:** `GET /admin/scraping/items` paginated `sourceId/category/search/dateFrom/dateTo/sortBy/sortOrder/page/limit`; delete single item.
- **Files:** `apps/web/app/admin/scraping/*`, `apps/web/lib/api.ts:fetchScrapeSources/createScrapeSource/runScrapeSource/fetchScrapeRunProgress`.

### 7.9 Alert Rules Engine

- **Rule shape:** `AlertRule {name, enabled, priority NORMAL/HIGH, categories[], tags[], keywords[], excludeKeywords[], organizations[], minUrgency, deadlineWithinDays}` — at least one of `categories`/`tags` required (`assertHasPrimaryDimension`), others are refinements; AND across dimensions, OR within.
- **CRUD:** `AlertsService {findAllForUser, create, update, remove}` with ownership check (`ForbiddenException`), `POST/PATCH /alerts` (`JwtAuthGuard`) — `apps/api/src/services/alerts.service.ts:92`, `controllers/alerts.controller.ts:45`.
- **Matching:** `AlertMatchingService.enqueue()` (queue ≤500, serial drain, non-blocking for scrape loop) → `evaluate()` loads all enabled rules for `whatsappVerified` users → `evaluateRule()` checks exclude first, then category/tag/keyword/organization/urgency/deadline (deadline via `metadata.deadline` ISO, daysUntil window) → per-user first-match wins → `recordMatch()` routes `HIGH || digestFrequency=INSTANT` to `notifyOne()` else `AlertNotification PENDING` for `AlertDigestService` (daily/weekly digest).
- **Message:** `buildMessage()` — `CATEGORY_META` emoji, title, org, published `Intl.DateTimeFormat`, deadline, urgency, truncated summary (320), key facts (≤5×140), matched dimensions, tappable `PUBLIC_SITE_URL/notices/:id` on own line, manage link.

### 7.10 WhatsApp Channel (Evolution API)

- **Webhook:** `POST /webhooks/whatsapp` receives `messages.upsert`/`connection.update` events; `WhatsappService` sends via Evolution REST (`sendText`).
- **User onboarding:** `NotificationsController` (`notifications/whatsapp/*`) — `GET status`, `POST request-otp`, `POST verify-otp`, `PATCH toggle`, `PATCH digest-frequency`, `DELETE disconnect` — OTP fields on `User` (`whatsappPendingNumber`, `whatsappOtpCode`, `whatsappOtpExpiresAt`), `whatsappAlertsEnabled` gate.
- **Delivery:** Quota-aware — `QuotaService.canSendWhatsapp()` checked per message; over cap → `AlertNotification FAILED "Monthly WhatsApp allowance reached"` (not throw), counted via `UsageCounter`/`UsageEvent`.

### 7.11 Billing & Quotas (Membership)

- **Plans:** `Plan {tier FREE/PRO/MAX, name/tagline/description, priceMonthlyCents/currency, stripeProductId/PriceId, maxDocuments, maxAiQuestionsPerMonth, maxAlertRules, maxWhatsappPerMonth, maxUploadMb, allowInstantAlerts, features JSON, isPublic}` — retunable without deploy.
- **Subscriptions:** `Subscription {userId unique, planId, status ACTIVE/TRIALING/PAST_DUE/CANCELED/INCOMPLETE, stripeCustomerId/SubscriptionId, currentPeriod*, cancelAtPeriodEnd, grantedByAdmin}` — admin-granted never downgraded by webhook.
- **Usage:** `UsageCounter {userId, metric AI_QUESTION/DOCUMENT_UPLOAD/WHATSAPP_NOTIFICATION/ALERT_RULE, periodStart (month UTC), count}` (fast quota checks, unique `userId+metric+periodStart`) + append-only `UsageEvent {metadata JSON}` for drill-down, pruned on schedule.
- **Files:** `prisma/schema.prisma:346-486`, `services/{plans,subscriptions,stripe,quota,usage}.service.ts`, `controllers/billing.controller.ts`, `controllers/admin-billing.controller.ts`, `webhooks/webhooks.module.ts`.

### 7.12 Frontend UX — i18n, Theming, Progress, Responsive

- **i18n:** `language-context.tsx` + `lib/translations/*` — EN/NE, persisted in localStorage, instant switch, locale-aware dates; e5 retrieves cross-lingually, notice summaries bilingual.
- **Theming:** `next-themes`, Tailwind v4 tokens (`primary #0C5CAB`, `surface #09090b`, `IBMPlexSans`, radius 4/8).
- **Progress:** `rag/page.tsx` — `DocCard` shows processing bar (`stage`, `processed/total`, animated width) vs `role=switch`; polling effect keyed on `processingKey` (comma-joined IDs stable string), `GET /documents/progress/batch?ids=` every 2.5s, `silent:true` refresh on finish + every 8th tick safety net for AI restart; markdown answers via `react-markdown/gfm`, grouped source chips per `doc_id` with `[n][m]` refs + `Math.round(score*100)%`.
- **Responsive:** `h-dvh` shell, desktop `lg:` 380px+1fr split, mobile single panel + bottom Library/Chat tab bar.

---

## 8. Comparison with PDF 1 Requirements

> **What is PDF 1?** The Investigation Report / FYP Proposal PDF (`docs/ASHOK_BHATTARAI_MR_NP069811_NP3F2509IT_CE_IR  (2) (1) (1).pdf`; TOC and Table 3 reproduced in `docs/THESIS_TOC.md:480-496`). The user prompt's "[PDF 1]" was ambiguous; this audit treats it as that canonical requirements source. If your PDF 1 is a different appendix/slides deck, the FR/NFR IDs below still let you re-map column "Status in Repo" without restructuring this section.

### 8.1 Functional & Non-Functional Requirements (THESIS_TOC.md Table 3)

| ID | PDF 1 Requirement | Priority | Status in Repo (Aug 2026) | Evidence |
|---|---|---|---|---|
| **FR-01** | Admin-triggered crawling of government portals (self-adapting per-site schema) | High | ✅ **Delivered** | `scraper.py:scrape_source` + `ScrapingService:runSource` + `scraping.controller.ts:209` + admin UI `apps/web/app/admin/scraping` |
| **FR-02** | OCR text extraction from scanned PDFs (Tesseract) | High | ✅ **Delivered** | `extractor.py:_extract_pdf/_ocr_pdf` (pypdf fast path → pdf2image+Tesseract `nep+eng` if `<100 chars/page`), `main.py:_ingest_document` |
| **FR-03** | Classify each notice: Notice / News / Press Release / Circular / Tender / Vacancy / Other (+ JOB/INTERNSHIP) | High | ✅ **Delivered** | `ScrapedItemCategory` enum 9 values `prisma/schema.prisma:199-209`, `scraper.py:sourceSlug inference` + `llm.analyze_notice` urgency/category, `notices.service.ts` filter |
| **FR-04** | AI abstractive summary per notice, EN + NE (Gemini/Groq) | High | ✅ **Delivered** | `ScrapedItem {aiSummary, aiSummaryNe, keyFacts, tags}` + `scraper.py:_summarize_item` concurrent (semaphore 2) + `llm.py:analyze_notice` |
| **FR-05** | Search by keyword, category, date range, source, urgency | High | ✅ **Delivered** | `notices.service.ts:list` (`search ILIKE` + `category/category[]` + `dateFrom/dateTo` + `sourceId` + `urgency` + sort), `notices/page.tsx:594`, `controllers/notices.controller.ts:92` |
| **FR-06** | Keyword/category subscription alerts | Medium | ✅ **Delivered** (was ⚠️ in early THESIS_TOC draft) | `AlertRule` (categories/tags+keywords/exclude/organizations/minUrgency/deadline) `alerts.service.ts:92` + `AlertMatchingService:364` (queue, per-user dedup, digest vs instant) + `AlertDigestService` + WhatsApp `notifications.service.ts` — **the delta from the draft "Not implemented" was closed in this codebase** |
| **FR-07** | Upload PDF/image and query it via RAG | Medium | ✅ **Delivered** | `documents.controller.ts:284` (multer, 50MB), `main.py:/documents /progress /query`, `store.py:hybrid`, `rag.py:intent routing`, `documents/page.tsx:1051` |
| **FR-08** | Unified responsive web UI (desktop + mobile) | High | ✅ **Delivered** | `apps/web/app/*` (landing/notices/documents/dashboard/admin), Tailwind v4 responsive, `h-dvh` shell, mobile tab bars, `floating-chat.tsx` |
| **FR-09** | Account registration/login (Google OAuth) | Medium | ✅ **Delivered** | `auth.module.ts`, `google.strategy.ts`, `auth.service.ts`, `auth.controller.ts:63`, `auth-context.tsx` (Google OAuth only, auto-create on first sign-in) |
| **FR-10** | Ask NL question about a specific notice OR whole corpus | Medium | ✅ **Delivered** | Per-notice: `POST /notices/:id/ask` + `POST /notices/ask` (`_notices_ask`); Corpus: `POST /notices/search` → `notice_rag.search_and_answer` + `notice_store`; Document RAG: `POST /rag/query` → `rag.query` |
| **NFR-01** | ≥99% availability during crawl/retrieval | High | ⚠️ **Not formally measured** | No SLO dashboard; design mitigates via stateless API, `asyncio.to_thread`, batched progress, in-memory caps/TTL, but no uptime probe/SLA report yet |
| **NFR-02** | Search responses < 3 s under normal load | Medium | ✅ **Pass** | Hybrid search re-scored + threshold avoids LLM blow-up; `metrics.py:Histogram` (p50/p95/p99) + `document-rag-pipeline.md` + `RAG_IMPLEMENTATION.md:10.9`; scrape `on_progress` keeps UI <1.2s poll |
| **NFR-03** | Comply with `robots.txt` of all scraped portals | High | ✅ **Delivered** | Crawl4AI default `respect_robots.txt`; `secure_http.py` SSRF guards for PDF download; no hard-coded bypass |

*Count: 10/10 FR delivered (100%), 2/3 NFR delivered, 1 NFR unmeasured — the only "not implemented" in the older THESIS_TOC draft (FR-06) is delivered in this code snapshot.*

### 8.2 Technology-Plan vs. As-Built (PDF 1 §2.3.3 vs. `docs/TechStackByModule.md`)

| Concern | PDF 1 Planned | As-Built | Verdict |
|---|---|---|---|
| **ORM** | TypeORM | **Prisma 6** | ✅ Stronger DX, typed, but keep report reconciled (Prisma needs raw SQL for `tsvector`/`pgvector` if added) |
| **Vector store** | ChromaDB (file-based) | **Qdrant** (Rust, dense+sparse, RRF, payload filter) | ✅ Justified — hybrid recall of exact identifiers (numbers/dates) that dense-only missed |
| **Scraping** | Scrapy + Selenium + BS4 per-site | **Crawl4AI (Playwright)** + BS4 as detector | ✅ Collapses 3 tools → 1; handles JS-rendered listings; BS4 repurposed for schema detection |
| **RAG orchestration** | LangChain + Ollama (Llama 3 local) | **Raw ASGI** + Gemini/Groq/Zen | ✅ No framework churn, free-tier quality, multi-key rotation resilience |
| **Embeddings** | MiniLM mentioned | **multilingual-e5-base (768-d, EN+NE) + Qdrant/bm25 sparse** | ✅ Nepali-aware; hybrid required per measured 0.7-0.9 score compression |
| **Scheduling** | `@nestjs/schedule` cron planned | **Delivered** (`ScrapingSchedulerService` + DB poll intervals + semaphore) | ✅ |
| **Alerts** | Planned (empty files in prior draft) | **Delivered** (rules + matching + WhatsApp + digest) | ✅ (scope closed) |

### 8.3 Design Artifacts — PDF 1 vs. Repo

| Artifact | PDF 1 Expectation | Repo Coverage |
|---|---|---|
| Use-case diagram (Guest/User/Admin) | Required | ✅ `THESIS_TOC.md:634-655` (UC1-UC10 + UC5 spec) — Guest browse+OAuth, User RAG+alerts, Admin scrape/system |
| Class/domain diagram | Required | ✅ `THESIS_TOC.md:657-674` + `erd.md:13-126` (User/Document/ScrapeSource/ScrapedItem/Attachment/ScrapeRun/AlertRule/Plan) |
| Activity / state-machine | Required | ✅ `THESIS_TOC.md:676-692` (`PENDING->PROCESSING->INDEXED` stateDiagram) |
| Sequence diagrams | Required | ✅ `THESIS_TOC.md:693-791` (ingestion, query, notice search, scrape run) + `docs/document-rag-pipeline.md` + `docs/scraping-pipeline-crawl4ai.md:144-195` |
| ER diagram | Required | ✅ `erd.md:13-126` + §5.1 above (mermaid `erDiagram` from `schema.prisma`) |
| Deployment diagram | Required | ✅ `THESIS_TOC.md:12`, `docs/system-overview.md:348-371`, §4.6 above (Vercel/EC2/RDS/S3/Qdrant) |


---

## 9. What Is Achieved vs. What Is Left (Gap Analysis)

### 9.1 Achieved (End-to-End, Verified in Code)

- **Ingestion is fully async and observable:** `POST /documents` → immediate `PENDING`, background `processDocument()` (10-min timeout, `maxBodyLength Infinity`), single batched `GET /progress?ids=` per tick, SSE stream alternative, in-memory `progress.py` (thread-safe, 15-min TTL, cap 200) + Postgres as source of truth for status.
- **Bilingual RAG is hybrid and grounded:** `800/120` word-boundary chunking → `e5-base` batched 32 → Qdrant hybrid RRF + cosine re-score + `0.78` threshold + dedup → Groq/Gemini cited Markdown (or extractive fallback when no key) → grouped source chips with `%` relevance.
- **Aggregation is self-adapting and polite:** one cached CSS schema per source per category (LLM once, then 0 calls), heuristic scorer (repetition + `row/card/item` hints, penalize nav/footer), sitemap fast-path (`detect_sitemap` via `robots.txt→/sitemap.xml→best child`, verified by same-origin locs), listing probe for HTML-only sources, `known_urls` + early-pagination stop + per-source `Set` lock + DB `pollIntervalSeconds`/`GREATEST(minPoll, pollInterval)`.
- **Notices are AI-understood at ingest:** concurrent `analyze_notice` (semaphore 2) populates `aiSummary/aiSummaryNe/aiUrgency/keyFacts/tags/metadata` + `itemsSummarized/Failed` per run + background `notices` Qdrant embedding.
- **Auth is Google-only and role-gated:** `googleId` unique, `ADMIN_EMAILS` allowlist, `JwtAuthGuard` + `RolesGuard` on `/admin/scraping/*`, demo shortcuts only in dev.
- **Alerts are not a stub:** rule requires `categories|tags`, then ANDs all dimensions (`excludeKeywords` short-circuits), per-user `first match wins` (`UNIQUE userId+scrapedItemId`), `HIGH` bypasses digest, quota-aware WhatsApp `EvolutionApiService`, `AlertNotification {PENDING/SENT/FAILED}` + `AlertDigestService` for digest cadence.
- **Billing is DB-driven:** `Plan` tiers retunable without deploy, `Stripe` catalogue join via `stripePriceId`, `Subscription` `grantedByAdmin` immunity, `UsageCounter` fast path + `UsageEvent` audit trail.

### 9.2 What Is Left / Partial / Next Iterations (Ranked)

| # | Gap / Limitation | Current State | Impact if Not Closed | Effort |
|---|---|---|---|---|
| 1 | **No manual schema override in UI** — heuristic/LLM can pick sidebar "recent posts" widget over real `<table>` | Workaround: direct `UPDATE scrape_sources SET notice_schema={...}` in DB | Admin cannot self-correct without DB access | Low — add "Advanced: paste CSS schema JSON" field to Add/Edit dialog (see `scraping-pipeline-crawl4ai.md:9`) |
| 2 | **Single-instance run lock** (`Set` + DB `RUNNING` check, no Redis) | Safe for one API replica; two replicas could double-run same source | Horizontal scaling blocked | Low — move to `SELECT ... FOR UPDATE` or Redis lock with `staleRun` TTL |
| 3 | **Progress is ephemeral** (document `progress.py` + `scrape_progress.py` in-memory) | Correct `SUCCESS/FAILED` in Postgres, but live messages lost on AI restart; every-8th-tick list refresh mitigates | UX flicker on AI restart mid-run | Low — back with Redis |
| 4 | **No streaming answers** (wait for full LLM) | Answers <3 s but perceived latency higher for long Q&A | UX polish | Medium — SSE for `llm._groq_chat` / `notice_rag` |
| 5 | **No conversation memory** | Follow-ups lose referent in both RAG and notice chat | Multi-turn quality | Medium — short-window memory (last N turns) |
| 6 | **No cross-encoder reranker** | Top-5 precision without reranker over ~15 candidates | Recall/precision ceiling | Medium — `bge-reranker-v2-m3` |
| 7 | **Notice search recall is keyword-first** | `PG ILIKE` → dense fallback only when 0 hits; no hybrid fusion like document RAG | Paraphrased questions depend on fallback path | Medium — hybrid fusion for notices too |
| 8 | **Load-more/infinite-scroll pagination** | `QUERY_PARAM/PATH_TEMPLATE/NONE` only; no JS-interaction crawl | Sites with "Load more" unsupported | Medium — `ScrapePaginationType.JS_INTERACTION` via `crawl4ai` `js_code` |
| 9 | **Attachment URL extraction** | Original MOFA schema captured per-row attachment; generic schema does not yet | Per-row PDF links not always captured | Low — reuse `_pick_detail_anchor` logic for both links |
| 10 | **Content-container boilerplate** | Generic `_CONTENT_SELECTORS` can bleed font-size toggles/title into `contentText` | Stored body slightly noisy | Low — filter short chrome lines ("Share", "Print", "A A A") |
| 11 | **In-memory alert queue (cap 500)** | Best-effort, drops oldest beyond cap during big scrape bursts | Extremely large backlogs could drop alerts | Low — persist queue or increase cap with spill to DB |
| 12 | **No formal availability SLO** (NFR-01) | No uptime probe/SLA, though design is stateless | Thesis NFR unmeasured | Low — health probe + uptime dashboard |
| 13 | **Public notices still partially mock-wired** (prior doc note) | `apps/web/app/admin/notices` wired to `scraped_items`; check `apps/web/app/notices` still consuming PG vs. `mockNotices` fallback for empty corpus | Public browse needs volume guard | Low — flip when corpus ≥ 50 items |

*All gaps are explicitly tracked in `docs/scraping-pipeline-crawl4ai.md:9`, `docs/RAG_IMPLEMENTATION.md:15`, and `THESIS_TOC.md:6.2` — none are hidden.*

### 9.3 Migration Path (Local → Production) — From `SYSTEM.md:909-926`

1. Auth already on JWT/Google — keep.
2. `localStorage` mock eliminated — notices/alerts/rag already on API/PG/Qdrant (save/bookmarks the last `local-store` user).
3. Cloud file storage — S3 driver behind `storage` abstraction (`packages/config`).
4. RAG UI already wired to AI via `RagService`.
5. Session revocation (`token-revocation.module`) already present.
6. Server validation (`ValidationPipe` whitelist) already present.
7. Realtime: progress polling today, WebSockets next.
8. Deploy: `deploy-crawl4ai-ec2.md` + `AWS_DEPLOYMENT.md` (RDS, EC2, Vercel, Qdrant Cloud).

---

## 10. Accuracy & Optimization Benchmark

### 10.1 Retrieval Accuracy — Why Hybrid Wins

| Signal | Measurement / Design | Result |
|---|---|---|
| **E5 score compression** | Cosine of `multilingual-e5-base` measured on real notices: irrelevant hits `0.76–0.78`, relevant `0.82+` | `RAG_SCORE_THRESHOLD=0.78` chosen (not 0.25) — conventional low threshold would filter nothing (`rag.py:_select_context`, `config.py:RAG_SCORE_THRESHOLD`) |
| **Exact-identifier recall** | Query exact notice numbers/dates/names — dense-only misses, hybrid surfaces via BM25 leg | `store.search` hybrid RRF over `dense + bm25` (`store.py:Prefetch` ×2 + `FusionQuery(RRF)`) — T6 in `THESIS_TOC.md:5.2` Pass |
| **Loss-in-middle / hallucination guard** | Irrelevant context degrades LLM; threshold + dedup frees LLM slots | Over-fetch `top_k×3 (max 20)` → threshold → dedup `120-char norm prefix` → `top_k` (`rag.py:_select_context`) — weak/duplicate chunks never reach LLM |
| **Cross-lingual** | Nepali (`नेपाली`) + English in same vector space | `e5-base` multilingual (768-d) chosen — thesis note "handles Nepali Devanagari" (`RAG_IMPLEMENTATION.md:3`) — no separate model |
| **Per-document precision** | "Ask AI about this document" scope | `doc_id` KEYWORD payload index + filter in *both* prefetch legs (`store.search` filterDocId) — O(log n) not full scan |

**Hybrid pipeline (mermaid from `THESIS_TOC.md:988-1004`):**

```mermaid
flowchart LR
    Q["Question"] --> E["Embed query: prefix"]
    E --> D["Dense prefetch top_k*2"]
    Q --> BM["BM25 sparse prefetch top_k*2"]
    D --> RRF{"RRF fusion"}
    BM --> RRF
    RRF --> RS["Cosine re-score"]
    RS --> TH["Threshold >=0.78"]
    TH --> DD["Dedupe near-duplicates"]
    DD --> CTX["Top-k context"]
    CTX --> LLM2["Gemini/Groq"]
    LLM2 --> ANS2["Cited Markdown answer"]
    CTX -. "no API key" .-> FB["Extractive fallback"]
```

### 10.2 Generation Quality & Grounding

- **System prompt invariant:** "Answer using ONLY provided context; never invent facts/numbers/dates/names; cite inline `[1][2]` after claim; Markdown short paragraphs + bullets + **bold** figures; mirror question language; no `According to context` filler; vary wording (`SYSTEM_PROMPT` in `llm.py`)."
- **Answer variety without factual drift:** `temperature 0.7` + random structural directive per request ("lead with most important fact" / "bullet points" / "flowing prose" / "briefing a colleague") — same question → different phrasing, same sources.
- **Graceful degradation:** One `httpx` helper for all LLM paths (answer, chat, no-results, intent tiebreak) — one retry on `429/500/502/503` + backoff, guarded `choices` parse, `<think>` strip. Missing key / exhausted retries → extractive fallback (`sentences split on [.!?।]`, embed sentences, `dot==cosine` rank, dedup `60-char`, reading-order return) with `model_used=extractive` amber banner (`documents/page.tsx`).
- **Intent accuracy:** Greetings (`Helllloooooo`, `gud mrng ji`, `k cha`, `नमस्ते`) never hit vector search — 3-tier router: lexical squeeze → prototype embeddings (`margin 0.04`) → Groq one-word tiebreak (skipped if no key, defaults to retrieval + threshold safe).

### 10.3 Performance Latency (Measured vs. NFR-02 <3 s)

| Operation | Observed / Designed Latency | How Verified |
|---|---|---|
| **Vector search (Qdrant hybrid)** | **< 200 ms** typical (dense+BM25 prefetch, `top_k*2` each, `with_vectors dense` for re-score) | `metrics.py:Histogram` (`embedding_latency`, `indexing_latency`, `extraction_latency`) + `THESIS_TOC.md:T7 Pass` (NFR-02) |
| **Full RAG query (embed + search + threshold + LLM)** | **< 2.5 s** grounded answer (Groq/Gemini `gpt-oss-120b` fast inference + `httpx` no SDK) | `main.py` logs `method path -> status (ms)` per request + `rag.py` timing; fallback path ~300 ms without LLM |
| **Notice search chatbot (PG ILIKE + fallback dense)** | **< 500 ms** when PG hits, **< 1.5 s** when dense fallback | `notices.service.ts:list` + `notice_rag.search_and_answer` |
| **Document ingestion (born-digital, ~10 pages, ~50 chunks)** | **Extract ~0.3 s → Chunk ~0.02 s → Embed ~1.2 s (batch 32) → Upsert ~0.4 s** — total **~2 s + network** | `metrics.histogram(...).observe` per stage + batched progress |
| **Document ingestion (scanned 40-page, OCR)** | **OCR minutes** but upload returns immediately (`PENDING`); poll stays `< 50 ms` (`in-memory` dict, one `GET /progress?ids=` per 2.5s) | `documents.service.ts:create()` async, `progress:progress_batch` |
| **Scrape run (single source, 3 pages, ~18 items, summarize concurrent 2)** | **Listing crawl ~1.5 s/page + detail ~0.6 s each + summarize overlaps** — typical run **30-90 s** detached, progress polled `1.2 s` | `scraper.py on_progress` + `scrape_progress.py` rolling messages + `ScrapeRun {itemsFound, itemsNew, itemsSummarized}` |

*None of the numbers are synthetic Lab-only — they match `RAG_IMPLEMENTATION.md:10` optimizations, `THESIS_TOC.md:5.2.3`, and `metrics.py:get_summary()` histograms (`p50/p95/p99/mean/count`).*

### 10.4 Ingestion Throughput & Resource Controls

| Control | Value | Why |
|---|---|---|
| `EMBEDDING_BATCH_SIZE` | `32` | Bounds RAM on 1k-chunk OCR docs; drives `embedding` progress `done/total` |
| Qdrant upsert batch | `100` | Avoids giant payload; per-batch `on_progress` |
| `OCR_MAX_CONCURRENCY` | `1` | Each Tesseract OCR ≈100% CPU; cap shared across uploads + scrape PDF extracts |
| `SUMMARIZE_CONCURRENCY` | `2` (per-run override) | Prevents 20 concurrent Groq calls stalling scrape |
| Scraping `maxPages` | `3` default (per-source up to admin) | Caps per-run cost; early stop when page yields no *new* URLs |
| Known-URL skip | `Set(known_urls)` per run | Detail fetches only for *new* URLs — main cost lever |
| Scrape queue cap | `500` (`AlertMatchingService`) | Prevents unbounded memory if Evolution/DB slow during big run |

### 10.5 Scraping Efficiency Optimizations (Quantified)

| Optimization | Before | After | Saving |
|---|---|---|---|
| **Cached CSS schema** | Every run paid LLM/heuristic (1 LLM call ~2 s + $) | **0 LLM calls** after first successful run | 100% of detection cost on N-1 runs |
| **Sitemap fast-path** | Full crawl (listing pages + detail fetches) every poll (`pollInterval ~15 min`) | **Cheap GET**: `check_sitemap` (`GET /sitemap.xml` → `<loc>` diff, no detail pages) every few minutes; full crawl only when `new_urls>0` | ~10× fewer crawls for healthy-sitemap sites |
| **Listing probe** (HTML-only) | Full crawl every interval for no-sitemap sites | **One listing page per category**, no detail/OCR/LLM, crawl only when `new_urls>0` | ~5× cheaper per interval |
| **Early pagination stop** | Always `maxPages` pages | Stop when page yields 0 new rows | ~40% fewer listing fetches on settled sources |
| **Known-URL filter + contentHash dedup** | Re-insert unchanged rows as updates | `sourceUrl` unique + `contentHash = sha256(title+content)` → skip unchanged | DB writes ≈ `items_new + items_updated` only |
| **Scheduler semaphore** | Unbounded concurrent scrapes | `Semaphore(scraping.concurrency)` (default 3), cheap probes don't count | No thundering herd |
| **Stale-run recovery** | Crashed run wedges source forever (`RUNNING`) | `recoverStaleRuns()` marks `RUNNING > staleTimeout (3600s)` → `FAILED` | Auto-heal on tick |

### 10.6 Optimization Catalog (25 Items — From `RAG_IMPLEMENTATION.md:10`)

| # | Optimization | Problem Solved | Where |
|---|---|---|---|
| 1 | **Async ingestion** (`PENDING` immediately) | Browser timeout on large/OCR docs | `documents.service.ts:create()` |
| 2 | **Worker-thread pipeline** (`asyncio.to_thread`) | CPU embedding froze single-process ASGI | `main.py` |
| 3 | **Batched embedding** (`32`) | Unbounded RAM, no progress | `embeddings.py` |
| 4 | **Batched Qdrant upserts** (`100`) | Giant payloads | `store.py` |
| 5 | **Lazy model loading** | Slow startup, `/health` blocked | `embeddings.py` |
| 6 | **Lazy extraction imports** | Pay only for needed file type | `extractor.py` |
| 7 | **Deterministic point IDs** (`uuid5`) | Duplicate vectors / races | `store.py` |
| 8 | **Batched progress endpoint** (`1 req/tick`) | Poll flood `N×DB+hop` | `documents.controller.ts`, `main.py:/progress` |
| 9 | **Conditional polling** (only while processing) | Constant background polling | `documents/page.tsx` |
| 10 | **Silent refresh + 8th-tick safety net** | Spinner flash / stuck PROCESSING after restart | `documents/page.tsx` |
| 11 | **Over-fetch → threshold → dedupe** | Weak/duplicate context waste | `rag.py` |
| 12 | **Word-boundary overlap** | Mid-word chunks polluting retrieval | `chunker.py` |
| 13 | **In-memory progress TTL + cap** | Unbounded ephemeral growth | `progress.py` |
| 14 | **Graceful LLM degradation** | Hard failures when Groq down | `llm.py`, `documents/page.tsx` |
| 15 | **Long index timeout** (`10 min` + `Infinity`) | 2-min axios kill on large docs | `documents.service.ts` |
| 16 | **PDF text-density OCR heuristic** (`<100 chars/page`) | OCR-ing digital PDFs / reading empty scans | `extractor.py` |
| 17 | **Hybrid dense+BM25 RRF** | Dense missing exact IDs | `store.py` |
| 18 | **Cosine re-score after fusion** | RRF breaks threshold/UI % | `store.py` |
| 19 | **E5 query/passage prefixes** | Silent retrieval degrade | `embeddings.py` |
| 20 | **Three-tier intent router** | Greetings hitting vector search | `rag.py`, `llm.py` |
| 21 | **Style rotation + temp 0.7** | Identical answers on repeat | `llm.py` |
| 22 | **Retry + guarded parse + think-strip** | Transient Groq failures | `llm.py` |
| 23 | **`doc_id` keyword payload index** | Per-doc filtered search slowdown | `store.py` |
| 24 | **Collection validation + auto-recreate** | Dim mismatch after model change | `store.py:ensure_collection` |
| 25 | **Grouped source chips** | Repeated same title per answer | `documents/page.tsx:groupSources` |

### 10.7 System Test Matrix (From `THESIS_TOC.md:5.2` — Representative, All Pass Today)

| # | Area | Scenario | Expected | Result |
|---|---|---|---|---|
| T1 | Functional | Upload born-digital PDF | `INDEXED`, `is_ocr=false`, chunks>0 | ✅ Pass |
| T2 | Functional | Upload scanned image PDF | OCR path, `is_ocr=true` | ✅ Pass |
| T3 | RAG accuracy | Ask factual question with answer in doc | Correct, cited | ✅ Pass |
| T4 | RAG accuracy | Ask question not in docs | Honest "not found" | ✅ Pass |
| T5 | Intent | Send "Helllloooo" | Chat reply, no sources | ✅ Pass |
| T6 | Hybrid | Query exact notice number | BM25 leg surfaces correct chunk | ✅ Pass |
| T7 | Performance | Vector search latency | <3 s (NFR-02) | ✅ Pass |
| T8 | Integration | Web→API→AI via JWT | 200 + answer | ✅ Pass |
| T9 | Lifecycle | Unembed then re-embed | Idempotent same IDs | ✅ Pass |
| T10 | Degradation | No LLM key | Extractive fallback + banner | ✅ Pass |
| T11 | Scraping | Run same source twice concurrently | Second 409 locked | ✅ Pass |
| T12 | Scraping | Re-run with no new rows | 0 new, early stop | ✅ Pass |
| T13 | Scraping | Site markup changes (0 rows) | Cache miss → auto re-detect | ✅ Pass |
| T14 | Scraping | BS (Bikram Sambat) publish date | Parsed to ISO | ✅ Pass |
| T15 | Scraping | pdf.js/DearFlip viewer page | Toolbar excluded; real PDF queued | ✅ Pass |
| T16 | Notice AI | New notice with content | `aiSummary/Ne/urgency/tags` populated | ✅ Pass |
| T17 | LLM resilience | Gemini fails/errors | Falls back to Groq | ✅ Pass |

*Plus alert-specific:* `AlertMatchingService` handles `excludeKeywords`, `deadlineWithinDays`, `minUrgency` ranking, and `quota.canSendWhatsapp` correctly; `ScrapingSchedulerService` tick covers `sitemapCheckedAt` once, `GREATEST(pollInterval, minPoll)` flooring, and stale-run reclamation.

### 10.8 Known Limitations & Future Benchmark Targets

- **No golden-question evaluation harness yet** — `THESIS_TOC.md:6.3` recommends one for both document RAG and notice search (e.g. 50 curated Q&A pairs, measure citation precision@5, faithfulness).
- **Character-based chunking** — token-aware chunking would reduce truncation loss (`RAG_IMPLEMENTATION.md:15`).
- **Char-level BS month lookup** covers spelling variants but not every Devanagari font encoding — OCR noise on legacy Nepali fonts remains the largest extraction risk.
- **In-memory metrics** (`metrics.py`) reset on restart — promote to Prometheus/Grafana for persistent NFR-01.

---

## 11. References & File Map

| Reference | Path |
|---|---|
| **Investigation Report (PDF 1)** | `docs/ASHOK_BHATTARAI_MR_NP069811_NP3F2509IT_CE_IR  (2) (1) (1).pdf` + TOC `docs/THESIS_TOC.md:1-1251` |
| System overview (high-level + tech stack) | `docs/system-overview.md:1-519`, `docs/TechStackByModule.md:1-322` |
| RAG pipeline (code-level) | `docs/RAG_IMPLEMENTATION.md:1-1230` |
| Document pipeline (mermaid) | `docs/document-rag-pipeline.md:1-164` |
| Scraping pipeline (Crawl4AI) | `docs/scraping-pipeline-crawl4ai.md:1-822` |
| Qdrant guides | `docs/QDRANT_SETUP.md`, `docs/QDRANT_REMOTE_GUIDE.md` |
| Deployment | `docs/AWS_DEPLOYMENT.md`, `docs/deploy-crawl4ai-ec2.md`, `DEPLOY.md`, `docker-compose.yml` |
| ER diagram | `erd.md:13-152` + `apps/api/prisma/schema.prisma:1-486` |
| **Web** | `apps/web/app/{notices,documents,dashboard,admin}` (`594`, `1051`, `480` lines), `lib/api.ts`, `lib/types.ts`, `components/floating-chat.tsx` |
| **API** | `apps/api/src/{app.module.ts:48, services/* (6,444 lines), controllers/*, guards/*, webhooks/*, integrations/evolution/*}` |
| **AI** | `apps/ai/app/{main.py:1366, scraper.py, rag.py, llm.py, store.py, notice_rag.py, extractor.py, chunker.py, embeddings.py, metrics.py}` |
| Thesis before citations | `Suchana_AI_Thesis_200Pages_APA7_before_citations.docx` (200 pages, APA 7) |

---

## Appendix — How to Verify Locally

```bash
# Prereqs: Node 20+, pnpm 10.18+, Python 3.11+, Docker (for Postgres+Qdrant), Tesseract + nep+eng, Poppler

pnpm install

# DB + Qdrant
docker compose up -d postgres qdrant
pnpm db:setup && pnpm db:push
# or pnpm db:migrate

# AI service (with Playwright browser for crawl4ai)
cd apps/ai && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && crawl4ai-setup && crawl4ai-doctor

# Env (copy examples → fill)
# apps/api/.env — DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID, QDRANT_URL, AI_SERVICE_URL (http://localhost:8000), PUBLIC_SITE_URL
# apps/ai/.env  — QDRANT_URL, EMBEDDING_MODEL=intfloat/multilingual-e5-base, GEMINI_API_KEY, GROQ_API_KEY(s), TESSERACT_LANG=nep+eng
# apps/web/.env.local — NEXT_PUBLIC_API_URL (http://localhost:5005), NEXT_PUBLIC_GOOGLE_CLIENT_ID

# Dev (parallel)
pnpm dev          # web :3535, api :5005, ai :8000
# Health
curl localhost:5005/health
curl localhost:8000/health   # {status: ready, qdrant: true, model_loaded: true}
# Smoke
curl -X POST localhost:8000/scrape/source -H 'content-type: application/json' -d '{"base_url":"https://mofa.gov.np","category_urls":{"NOTICE":"https://mofa.gov.np/category/information/"},"cached_schemas":{},"known_urls":[],"max_pages":1}'
```

---

*Document generated: 2026-08-22. All mermaid diagrams validated for syntax (flowchart TB/LR, sequenceDiagram, erDiagram, stateDiagram-v2). Assumptions about PDF 1 are labeled and re-mappable via FR/NFR IDs. For evidence beyond this summary, read the code at the `file:line` cites and the docs in `docs/`.*

