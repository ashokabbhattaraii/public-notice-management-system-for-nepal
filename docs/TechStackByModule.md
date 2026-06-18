# Tech Stack by Module

> AI-Powered Cloud-Based Public Notice Management System for Nepal
> Author: Ashok Bhattarai (NP069811)
> Companion to the FYP report and `docs/system-overview.md`.

This document maps **every architectural section to the technology that powers
it**, clarifies what runs in the **Next.js (web)**, **NestJS (API)**, and
**Python (AI)** layers, explains *why* each choice was made, suggests
improvements, and **rates** each technology.

> ⚠️ **Report vs. as-built note:** the investigation report (§2.3.3) names
> **TypeORM** as the ORM; the actual codebase uses **Prisma 6**. The report's
> stack also lists **ChromaDB** as the vector store, but the project now uses
> **Qdrant** (a more production-ready, free/open-source choice). This document
> describes the **as-built** stack and flags such differences inline. Update the
> report or the code so the two agree before final submission.

---

## Table of Contents

1. [Architecture at a glance](#1-architecture-at-a-glance)
2. [Request/data flows](#2-requestdata-flows)
3. [Tech stack by module (master table)](#3-tech-stack-by-module-master-table)
4. [Layer ownership: who does what](#4-layer-ownership-who-does-what)
   - [4.1 Next.js (web) responsibilities](#41-nextjs-web-responsibilities)
   - [4.2 NestJS (API) responsibilities](#42-nestjs-api-responsibilities)
   - [4.3 Python (AI) responsibilities](#43-python-ai-responsibilities)
   - [4.4 Cross-cutting concerns](#44-cross-cutting-concerns)
5. [Why each technology (justification)](#5-why-each-technology-justification)
6. [Suggestions & improvements](#6-suggestions--improvements)
7. [Tech stack ratings](#7-tech-stack-ratings)
8. [Summary scorecard](#8-summary-scorecard)

---

## 1. Architecture at a glance

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                              │
│   Next.js 15 (App Router) · React 19 · Tailwind v4 · shadcn/ui · GSAP      │
└───────────────┬───────────────────────────────────────────┬──────────────┘
                │ REST (JSON, Bearer JWT)                     │ REST
                ▼                                             ▼
┌──────────────────────────────┐              ┌────────────────────────────────┐
│        NestJS 11 API          │   REST/      │        Python AI Service        │
│        (apps/api)             │   httpx      │        (apps/ai, ASGI)          │
│                               │ ───────────▶ │                                 │
│  Auth · Users · Notices       │ ◀─────────── │  Extraction · OCR (Tesseract)   │
│  Documents · RAG proxy        │              │  Embeddings · Qdrant · RAG      │
│  Prisma ORM · JWT · Guards    │              │  (LangChain optional)           │
└───────┬───────────────────────┘              └───────────────┬────────────────┘
        │ Prisma                                               │ persists
        ▼                                                       ▼
┌──────────────────┐                               ┌──────────────────────────┐
│  PostgreSQL       │                               │  Vector store (Qdrant)    │
│  (RDS / Neon)     │                               │  self-host or Qdrant Cloud│
└──────────────────┘                               └──────────────────────────┘
        │
        ▼ object storage
┌──────────────────┐
│  S3 (uploads)     │
└──────────────────┘

Monorepo glue: Turborepo 2.9 · pnpm 10 workspaces · shared packages (@pnm/types, utils, config)
```

---

## 2. Request/data flows

**A. Notice browsing (read path)**
```
Browser → GET /notices → NestJS → Prisma → PostgreSQL → JSON → Browser
```

**B. Document upload + indexing (write path)**
```
Admin (web) → POST /documents (multipart, JWT)
   → NestJS: validate (file-type) → S3/disk save → Prisma insert (status=pending)
   → NestJS → POST /documents → Python AI: extract → OCR(Tesseract) → chunk
       → embed(MiniLM) → Qdrant upsert → returns {isOcr, textLength, chunkCount}
   → NestJS updates Prisma (status=indexed)
   → web polls GET /documents/:id for live status
```

**C. RAG question answering**
```
Browser → POST /rag/query (JWT) → NestJS proxy → Python /query
   → Qdrant similarity search → (LLM compose) → {answer, sources}
   → back to Browser (answer + source citations)
```

**D. Scraping (planned)**
```
@nestjs/schedule cron → NestJS scraping job → Python scraper (Scrapy/Selenium)
   → extracted notices → Prisma insert → AI index → alerts match engine
```

---

## 3. Tech stack by module (master table)

Legend for **Layer**: 🟦 web (Next.js) · 🟩 API (NestJS) · 🟨 AI (Python) · 🟪 cross-cutting/infra

| # | Module / Section | Layer | Core technology | Supporting libs (as installed) |
|---|------------------|-------|-----------------|-------------------------------|
| 1 | Landing / marketing pages | 🟦 | Next.js App Router, React 19 | GSAP, Tailwind v4, lucide-react |
| 2 | UI component system | 🟦 | shadcn/ui + Radix UI | class-variance-authority, tailwind-merge, clsx |
| 3 | Theming (dark/light) | 🟦 | next-themes | CSS variables in `globals.css` |
| 4 | i18n (EN / नेपाली) | 🟦 | React Context (`language-context`) | translation files in `lib/translations` |
| 5 | Auth (client session) | 🟦 | `@react-oauth/google`, `lib/auth-context` | `lib/api.ts` (`tokenStore`, `apiFetch`), next-auth present |
| 6 | Auth (server) | 🟩 | `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt` | `google-auth-library` (ID-token verify) |
| 7 | Authorization (RBAC) | 🟩 | Nest guards | `JwtAuthGuard`, `RolesGuard`, `@Roles`, `@CurrentUser` |
| 8 | Users | 🟩 | NestJS service + Prisma | `ADMIN_EMAILS` allowlist |
| 9 | Notices CRUD | 🟩 | NestJS controller/service | Prisma (currently scaffold) |
| 10 | **Documents** | 🟩 | NestJS + `multer` (`FileInterceptor`) | `file-type`, `uuid`, storage driver |
| 11 | Object storage | 🟪 | Local disk → AWS S3 | `@aws-sdk/client-s3` (add for S3) |
| 12 | Relational data | 🟪 | PostgreSQL | Prisma 6 client (`pg` driver) |
| 13 | ORM / migrations | 🟩 | **Prisma** (report says TypeORM) | `prisma migrate`, `prisma generate` |
| 14 | Validation | 🟩 | `class-validator`, `class-transformer` | global `ValidationPipe` (whitelist) |
| 15 | Config / secrets | 🟩🟨 | `@nestjs/config`, dotenv | `.env` per app |
| 16 | RAG orchestration | 🟨 | Python ASGI + uvicorn | LangChain (optional, per report) |
| 17 | Text extraction | 🟨 | pypdf, python-docx | — |
| 18 | OCR | 🟨 | Tesseract via `pytesseract` | `pdf2image` + Poppler, Pillow |
| 19 | Embeddings | 🟨 | sentence-transformers (MiniLM multilingual) | Hugging Face models |
| 20 | Vector store | 🟨 | Qdrant (`qdrant-client`) | self-host (Docker) or Qdrant Cloud free tier |
| 21 | Classification / summarization | 🟨 | Hugging Face transformers (planned) | per report |
| 22 | Web scraping (planned) | 🟨 | Scrapy + Selenium | per report |
| 23 | Scheduling (planned) | 🟩 | `@nestjs/schedule` cron | `SCRAPING_INTERVAL_CRON` |
| 24 | Alerts / notifications | 🟩 | NestJS match engine (planned) | in-app + email (planned) |
| 25 | Monorepo build | 🟪 | Turborepo 2.9 | pipeline caching |
| 26 | Package management | 🟪 | pnpm 10 workspaces | `pnpm-workspace.yaml` |
| 27 | Shared contracts | 🟪 | `@pnm/types`, `@pnm/utils`, `@pnm/config` | TS types shared across apps |
| 28 | Language / typing | 🟪 | TypeScript 5.9 (web/api), Python 3.x (ai) | — |
| 29 | Hosting (planned) | 🟪 | Vercel (web), EC2/ECS (api/ai), RDS, S3 | per report |

---

## 4. Layer ownership: who does what

### 4.1 Next.js (web) responsibilities
- **Presentation & UX only.** Rendering pages, forms, dashboards, admin panels.
- Holds the **JWT in localStorage** (`tokenStore`) and attaches it as a Bearer
  header via `apiFetch`. Initiates Google sign-in client-side.
- **Never** talks to PostgreSQL, the vector store, or the AI service directly —
  always goes through the NestJS API. This keeps secrets and DB access server-side.
- File uploads use the browser's native `FormData`/`fetch` (multipart) to the API.

### 4.2 NestJS (API) responsibilities
NestJS is the **single trusted gateway** and system of record:
- **Authentication:** verifies Google ID tokens server-side
  (`google-auth-library`), mints its own stateless JWT (`@nestjs/jwt`).
- **Authorization:** `JwtAuthGuard` + `RolesGuard` enforce `user`/`admin` on
  every protected route; role is re-read from the DB per request.
- **Business logic & persistence:** Notices, Users, Documents via **Prisma →
  PostgreSQL**. Owns all data-integrity rules and validation (`ValidationPipe`).
- **Orchestration:** proxies to the Python AI service (document indexing, RAG
  queries) over REST so the browser never touches AI internals.
- **Scheduling (planned):** `@nestjs/schedule` triggers periodic scraping jobs.
- **Why a gateway?** Centralizes auth, validation, CORS, and rate limiting; the
  AI service can stay internal (not internet-exposed).

### 4.3 Python (AI) responsibilities
Python owns everything **AI/ML and document processing** — tasks where its
ecosystem is strongest:
- **Extraction:** PDF (pypdf), DOCX (python-docx), TXT.
- **OCR:** Tesseract (`nep+eng`) for scanned PDFs/images — central to the
  Nepal problem (gov portals publish scanned gazettes).
- **Embeddings:** multilingual MiniLM sentence-transformers (handles Nepali).
- **Vector search:** Qdrant collection; retrieval for RAG.
- **Summarization/classification (planned):** Hugging Face transformer models.
- **Scraping (planned):** Scrapy + Selenium.
- Runs as a **raw ASGI app on uvicorn** today; deliberately framework-light.

### 4.4 Cross-cutting concerns
| Concern | Mechanism | Spans |
|---------|-----------|-------|
| Type contracts | `@pnm/types` shared package | web + api (+ ai mirrors shapes) |
| Build/caching | Turborepo pipeline | all apps |
| Dependencies | pnpm workspaces | all apps |
| Config/secrets | `.env` + `@nestjs/config` / `os.getenv` | api + ai |
| AuthN/AuthZ | JWT issued by API, consumed by web | web + api |
| CORS | `WEB_ORIGIN` allowlist in `main.ts` | api |
| Storage | disk (dev) / S3 (prod) behind a driver | api + infra |
| Observability (gap) | none yet — see suggestions | all |

---

## 5. Why each technology (justification)

**Next.js 15 + React 19 (web)** — SSR/SSG, file-based routing, first-class
TypeScript, and frictionless Vercel + CDN deploy. Matches the report's stated
rationale (performance, DX, global delivery).

**Tailwind v4 + shadcn/ui + Radix** — utility-first styling plus accessible,
unstyled primitives you own in-repo (not a black-box component lib). CVA +
`tailwind-merge` give consistent, type-safe variants. Strong for WCAG 2.1 AA goal.

**NestJS 11 (API)** — TypeScript-first, opinionated module/provider architecture
(controllers → services → data layer) that scales and stays testable. Built-in
DI, guards, pipes, and `@nestjs/schedule` for cron scraping. Exactly the report's
justification.

**Prisma 6 (as-built ORM)** — type-safe queries, declarative schema, painless
migrations, great DX. *Note:* report says TypeORM; Prisma is arguably the
stronger modern choice but **the report must be reconciled.** Prisma's tradeoff:
PostgreSQL full-text (`tsvector`/`tsquery`) and `pgvector` need raw SQL or
`$queryRaw`, whereas the report leaned on TypeORM + tsvector.

**PostgreSQL (RDS)** — ACID, JSON columns for flexible notice payloads, and
mature full-text search (`tsvector`/`tsquery`) for keyword notice search.
Report-aligned. (Vector search lives in Qdrant, not Postgres — see below.)

**Qdrant (vector store)** — chosen over the report's ChromaDB because it is
production-grade: a dedicated, horizontally scalable vector DB with fast payload
filtering, written in Rust. It is **free and open-source** (Apache 2.0) to
self-host, and offers a **free 1 GB managed cloud tier**. It runs as its own
service, so it scales independently of the API/AI processes, and it is hidden
behind the AI service's `store.py` so it can be swapped if needs change.

**Python (AI)** — unmatched ecosystem for OCR (Tesseract), NLP/transformers
(Hugging Face), embeddings (sentence-transformers), vector DBs (Qdrant), and
scraping (Scrapy/Selenium). Multilingual MiniLM specifically supports Nepali.

**REST between API and AI** — simplest reliable integration; the report allows
"lightweight REST or message queue." REST is the right starting point; a queue
becomes worthwhile once indexing volume grows.

**JWT + Google OAuth** — stateless sessions (no server session store), trusted
identity provider, minimal credential handling. Server-side ID-token
verification is the secure pattern.

**Turborepo + pnpm monorepo** — one repo, shared types, cached builds, parallel
dev. Keeps web/api/ai contracts in sync via `@pnm/types`.

---

## 6. Suggestions & improvements

**High priority**
1. **Reconcile ORM choice** — update the report to Prisma (or migrate code to
   TypeORM). Don't ship a dissertation that contradicts the code.
2. **Background job queue** — replace fire-and-forget document indexing with
   **BullMQ + Redis** (or AWS SQS) so indexing retries and survives restarts.
3. **Operate Qdrant as a managed service** — use **Qdrant Cloud** (free 1 GB
   tier) in production rather than self-managing the container, so there's no
   stateful service to back up/monitor. Keep the local Docker Qdrant for dev.
   The store stays behind the `store.py` interface, so the choice is swappable.
4. **Observability** — add structured logging (pino/Nest Logger), request IDs,
   and basic metrics. There is currently no monitoring layer.

**Medium priority**
5. **Rate limiting** — add `@nestjs/throttler` on auth and query endpoints
   (report lists it as planned; implement it).
6. **Presigned S3 uploads** for files >10 MB so large bytes never stream through
   the API.
7. **Contract typing for AI** — generate/share a typed client (OpenAPI or a thin
   `@pnm/ai-client`) so API↔AI payloads can't drift.
8. **TS build errors are suppressed** (`ignoreBuildErrors: true` in
   `next.config.mjs`) — fix the underlying errors and turn this off; suppressed
   errors hide real bugs.

**Lower priority / future**
9. **Caching** — Redis or HTTP caching for hot notice lists.
10. **FastAPI for the AI service** — if framework use is permitted, it removes
    hand-rolled multipart/lifespan code and gives auto OpenAPI docs.
11. **CI/CD** — add a pipeline (lint + type-check + test) gating merges.

---

## 7. Tech stack ratings

Rated **out of 5** on **fit for this project** (not generic popularity).
Criteria: suitability to requirements, maturity, DX, operational cost, future-proofing.

| Technology | Rating | Verdict |
|------------|:------:|---------|
| Next.js 15 (App Router) | ⭐⭐⭐⭐⭐ 5.0 | Ideal for SSR + SEO + fast public pages; Vercel deploy is trivial. |
| React 19 | ⭐⭐⭐⭐½ 4.5 | Excellent; v19 is still settling, minor ecosystem lag. |
| Tailwind v4 | ⭐⭐⭐⭐½ 4.5 | Fast, consistent; v4 is new so some plugins/tooling lag. |
| shadcn/ui + Radix | ⭐⭐⭐⭐⭐ 5.0 | Accessible, owned-in-repo, perfect for the WCAG goal. |
| TypeScript | ⭐⭐⭐⭐⭐ 5.0 | Non-negotiable win; shared types across the monorepo. |
| NestJS 11 | ⭐⭐⭐⭐⭐ 5.0 | Right architecture for a multi-module gateway API. |
| Prisma 6 | ⭐⭐⭐⭐ 4.0 | Superb DX; −1 for awkward `tsvector`/`pgvector` (needs raw SQL) and report mismatch. |
| PostgreSQL | ⭐⭐⭐⭐⭐ 5.0 | ACID + JSON + full-text + pgvector path. Perfect fit. |
| JWT + Google OAuth | ⭐⭐⭐⭐½ 4.5 | Secure & simple; add refresh-token rotation for long sessions. |
| Python AI (uvicorn ASGI) | ⭐⭐⭐⭐ 4.0 | Correct language; raw ASGI is bare — FastAPI would raise this to 5. |
| Tesseract OCR | ⭐⭐⭐⭐ 4.0 | Essential for scanned Nepali gazettes; accuracy varies on poor scans. |
| sentence-transformers (MiniLM) | ⭐⭐⭐⭐½ 4.5 | Good multilingual/Nepali support, runs locally, no API cost. |
| Qdrant | ⭐⭐⭐⭐½ 4.5 | Production-ready, fast, great metadata filtering; free self-host + free 1 GB cloud tier. |
| LangChain (optional) | ⭐⭐⭐½ 3.5 | Useful abstractions but heavy/churny; use selectively. |
| Scrapy + Selenium (planned) | ⭐⭐⭐⭐ 4.0 | Standard, capable; Selenium is heavy — use only where JS rendering is required. |
| REST (API↔AI) | ⭐⭐⭐⭐ 4.0 | Right for now; add a queue as volume grows. |
| Turborepo + pnpm | ⭐⭐⭐⭐⭐ 5.0 | Excellent monorepo ergonomics and caching. |
| AWS (RDS/EC2/S3) + Vercel | ⭐⭐⭐⭐½ 4.5 | Proven, scalable; watch cost/ops of always-on EC2 for AI. |

---

## 8. Summary scorecard

| Dimension | Score | Notes |
|-----------|:-----:|-------|
| **Architecture fit** | ⭐⭐⭐⭐⭐ | Clean web → API gateway → AI separation; correct trust boundaries. |
| **Technology choices** | ⭐⭐⭐⭐½ | Modern, coherent, well-justified; Prisma/TypeORM doc mismatch is the main blemish. |
| **Scalability path** | ⭐⭐⭐⭐ | Stateless API + S3 + RDS scale well; Qdrant scales independently (use a job queue for indexing). |
| **Security posture** | ⭐⭐⭐⭐ | JWT, server-side OAuth verify, RBAC, magic-byte upload validation; add rate limiting + refresh tokens. |
| **Maintainability** | ⭐⭐⭐⭐½ | Monorepo + shared types + TS; −½ for suppressed TS build errors. |
| **Operational maturity** | ⭐⭐⭐ | Biggest gap: no observability, no job queue, no CI/CD yet. |
| **Overall** | **⭐⭐⭐⭐½ (4.3 / 5)** | Strong, well-reasoned, production-leaning stack appropriate to the project's goals. |

**Top three actions to raise the overall score:**
1. Reconcile the ORM (Prisma vs. TypeORM) between report and code.
2. Add a job queue + observability (operational maturity is the weakest area).
3. Use managed Qdrant Cloud in production and turn off suppressed TS errors.

---

*Cross-reference: see `docs/system-overview.md` for the full module map and
`docs/DOCUMENT_SECTION_GUIDE.md` for the Document section implementation.*
