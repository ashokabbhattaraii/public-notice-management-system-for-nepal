# Design and Development of an AI-Powered Cloud-Based Public Notice Management System for Nepal

**By** Ashok Bhattarai — NP069811 — NP3F2509IT

A report submitted in partial fulfilment of the requirements for the degree of
**B.Sc. (Hons) Information Technology, Specialism in Cloud Engineering**
at Asia Pacific University of Technology and Innovation.

Supervised by **Dr. Laxman Mandal** · 2nd Marker: **Manish Kumar Tamang** · 2026

> **Note on scope of this document.** This file is the full-thesis skeleton grown into a
> working draft. It carries the academic framing of the Investigation Report forward into the
> implementation phase and reconciles it with what was *actually built*. Three deliberate
> technology pivots happened between the proposal and the delivered system, and they are
> called out wherever they occur:
>
> | Investigation-phase plan | Delivered implementation | Why the change |
> |---|---|---|
> | **ChromaDB** (file-based vector store) | **Qdrant** (named dense + BM25 sparse vectors, RRF fusion, payload filters) | Hybrid search, per-document payload filtering, deterministic point IDs, production-grade REST/gRPC |
> | **Scrapy + Selenium + BeautifulSoup4** | **Crawl4AI** (async, Playwright-backed, LLM-ready Markdown) + **BeautifulSoup4** for CSS-schema detection | One tool handles static *and* JS-rendered pages, emits clean Markdown, native `robots.txt`/rate-limit support; BeautifulSoup4 is retained, not replaced, as the parser behind heuristic listing-schema detection |
> | **LangChain + Ollama (LLaMA 3, local)** | **Custom raw-ASGI pipeline + Gemini 2.0 Flash (primary) with Groq `llama-3.3-70b-versatile` (multi-key fallback)** | Zero framework overhead; Gemini's free tier and quality lead for the primary path, Groq (round-robin across several keys) absorbs overflow/outages |
>
> Everything below reflects the delivered stack. As of this revision, **both** major subsystems
> are implemented end-to-end: the RAG document-intelligence pipeline (Qdrant + Gemini/Groq) *and*
> the multi-site notice aggregation pipeline (Crawl4AI scraper with heuristic/LLM schema
> auto-detection, Nepali Bikram Sambat date parsing, PDF/attachment discovery, concurrent AI
> classification/summarisation, and a full admin scraping console). The one subsystem still a
> genuine placeholder is **notifications/subscription alerts** (empty controller and service
> files) — this is called out explicitly in §4 and §6.2.

---

## Declaration of Thesis Confidentiality

I declare that this thesis, *Design and Development of an AI-Powered Cloud-Based Public Notice
Management System for Nepal*, is the result of my own work except where due reference is made.
It has not been submitted, in whole or in part, for any other degree at this or any other
institution. Portions of this document may reference internal system designs; these are
provided for academic assessment and should be treated as confidential where indicated.

---

## Library Form

*[Standard APU library-deposit form — to be inserted from the template.]*

---

## Acknowledgements

The support and motivation offered by many people cannot be overstated. My deepest thanks go to
my project supervisor, Dr. Laxman Mandal, for guidance, constructive feedback, and steady
support throughout the research; that mentorship directed and steered the project well. I am
grateful to the academic staff of the School of Computing at Asia Pacific University of
Technology and Innovation for the knowledge and practical insight that formed the foundation of
this work in artificial intelligence, cloud computing, and software engineering.

I thank my colleagues and peers for their continuous encouragement and their technical
exchanges and critical suggestions, without which this work would have been the poorer. Special
acknowledgement is due to the open-source developer community whose tools, frameworks, and
documentation made this project possible: **Hugging Face**, **Crawl4AI**, **Qdrant**, the
**Groq** platform, **sentence-transformers**, and the wider Python and JavaScript ecosystems.
Finally, I owe my family my deepest gratitude for their constant support, patience, and belief
in me throughout this academic journey.

*Ashok Bhattarai (NP069811)*

---

## Abstract

Public information in Nepal is fragmented. Notices, vacancies, tenders, examination dates, and
policy updates are posted across dozens of independent government websites with no central point
of access, no common format, and often no machine-readable text at all. This burdens every
citizen, and disproportionately students, job seekers, and rural users who need timely,
authentic information but cannot afford to poll many portals repeatedly.

This project designs and builds an **AI-Powered Cloud-Based Public Notice Management System** —
a web platform that aggregates public notices from admin-configured official Nepalese government
portals, classifies and summarises them, and exposes them through a single searchable interface.
Aggregation is performed with **Crawl4AI**, an asynchronous, browser-capable crawler that
handles both static and JavaScript-rendered pages and returns clean Markdown; per-site listing
structure is learned automatically — a **BeautifulSoup4** heuristic scores candidate repeating
DOM groups, with an LLM fallback when heuristics fail, and the resulting CSS extraction schema is
cached so subsequent runs are pure, fast parsing. Scanned notices and PDF attachments are read
with **Tesseract OCR** (`nep+eng`); Nepali government sites frequently render dates in the
**Bikram Sambat** calendar, which the scraper parses natively alongside Gregorian formats.
Classification (Jobs/Exams/Tenders/Policy/Press-Release/etc.), urgency tagging, and abstractive
plain-language summarisation (English **and** Nepali) run **concurrently during scraping** via an
LLM. A **Retrieval-Augmented Generation (RAG)** module lets users interrogate both their own
uploaded documents and the aggregated notice corpus in natural language: text is chunked,
embedded with the multilingual **`intfloat/multilingual-e5-base`** model, and stored in
**Qdrant**, where a **hybrid dense + BM25** search fused with **Reciprocal Rank Fusion** retrieves
grounded context that **Gemini 2.0 Flash** (primary) or a key-rotated **Groq-hosted Llama 3.3
(70B)** (fallback) turns into a cited, Markdown answer.

The delivered system is fully working end-to-end across a **Next.js** frontend, a
**NestJS + Prisma/PostgreSQL** API, and a **Python raw-ASGI** AI service, deployed to **AWS**
(backend) and **Vercel** (frontend): document RAG, notice aggregation/classification/
summarisation, a public notice browser with hybrid-search chatbot, an admin scraping console with
live run progress, and a WhatsApp inbound channel are all implemented in code. The one
deliberately unbuilt subsystem is subscription/alert delivery. This report presents the research
background, literature review, methodology, detailed design and implementation, testing, and
results that together confirm the technical feasibility and civic relevance of the solution.

**Keywords:** public notice management, artificial intelligence, cloud computing, web crawling,
retrieval-augmented generation, hybrid search, Qdrant, Nepal e-governance.

---

## Table of Figures

| Figure | Title | Section |
|---|---|---|
| 1 | Agile (RAD) delivery cycle | 3.1 |
| 2 | High-level system architecture (Web + API + AI) | 4.1.1 |
| 3 | Data-flow diagram (Level 0 / Level 1) | 4.1.1 |
| 4 | Use-case diagram | 4.1.2 |
| 5 | Domain / class diagram | 4.1.3 |
| 6 | Document lifecycle state machine | 4.1.4 |
| 7 | Ingestion sequence (upload → vectors) | 4.1.5 |
| 8 | Query sequence (question → cited answer) | 4.1.5 |
| 8b | Notice-aggregation scrape-run sequence | 4.1.5 |
| 9 | Entity-Relationship diagram (PostgreSQL) | 4.2.1 |
| 10 | Qdrant collection & point schema | 4.2.2 |
| 11 | Hybrid retrieval + RRF fusion pipeline | 4.4.3 |
| 12 | Deployment diagram (AWS + Vercel) | 4.1.1 |

## Table of Tables

| Table | Title | Section |
|---|---|---|
| 1 | Technology choices and justification | 2.3.3 |
| 2 | Investigation plan vs. delivered stack | Preface |
| 3 | Functional & non-functional requirements | 3.3.3 |
| 4 | Prisma data model summary | 4.2.1 |
| 5 | Qdrant point payload fields | 4.2.2 |
| 6 | Optimisation catalogue (problem → fix) | 4.4.3 |
| 7 | Test matrix and outcomes | 5.2 |

---

## Chapter 1: Introduction to the Study

### 1.1 Background

Public information systems are a cornerstone of civic engagement and informed choice in
democratic societies. Governments continuously generate official communications — examination
timetables, vacancy announcements, tender notices, policy changes, administrative directives —
that carry legal weight and practical consequence for millions of citizens and organisations who
need timely access to make decisions about education, employment, procurement, and compliance.

The Government of Nepal issues these notifications through many ministries, commissions, and
regulatory bodies, each on its own website. There is no standard publication format, no central
repository, and no cross-portal search. A student awaiting a Public Service Commission
examination notice, a contractor tracking Ministry of Finance tenders, or a job seeker scanning
vacancy announcements must personally and repeatedly visit many sites over days or weeks. The
problem is compounded by technological inconsistency: many portals publish gazettes as **scanned
PDFs or embedded images** rather than machine-readable text, defeating even basic keyword search.

### 1.2 Problem Background

The core problem is **accessibility**, and it has four intertwined dimensions:

1. **Fragmentation.** Announcements are scattered across dozens of independent portals with
   divergent designs, content structures, and publication schedules. There is no shared metadata
   schema, no cross-portal search, no category filtering, and no subscription/alert service.
2. **Non-machine-readability.** A large share of gazetted notices are rasterised scans; the text
   is an image, not characters. Such content cannot be indexed, extracted, or read by a screen
   reader, and repeatedly downloading large PDFs penalises low-bandwidth users.
3. **Equity and geography.** Urban users with broadband and high digital literacy can navigate
   multiple portals; rural and semi-urban users, facing intermittent connectivity and higher
   relative data costs, are effectively excluded — an information asymmetry baked into the
   e-governance framework.
4. **No aggregating mechanism.** No existing government, commercial, or civic service in Nepal
   aggregates notices across sources, applies AI classification/summarisation, *and* offers
   document question-answering. This is the gap the project fills.

Building such a system is genuinely hard: portal architectures and HTML structures differ widely
and change without notice, demanding adaptive crawlers for both static and JavaScript-rendered
pages; scanned documents require a robust OCR pipeline with quality validation; and orchestrating
classification, summarisation, and document interaction in a cloud-hosted architecture requires
careful, modular system design.

### 1.3 Project Aim

> To design and develop a cloud-hosted web application that uses AI to automate the collection,
> categorisation, summarisation, and intelligent retrieval of public notices from selected
> Nepalese government portals, so that citizens can find and understand official announcements
> quickly, reliably, and in one place.

### 1.4 Objectives

1. **Investigate** the current state of public-notice publication in Nepal — common notice
   categories, extraction obstacles (scans, JS rendering), and citizen access barriers per target
   group.
2. **Build the aggregation pipeline** — a crawling and data-processing pipeline (Crawl4AI + OCR)
   that automatically fetches, extracts, normalises, and stores notices from **at least five**
   government sites, handling static pages, JS-rendered pages, and image/PDF notices.
3. **Add document intelligence** — integrate NLP models for automatic classification and
   plain-language summarisation, and a **RAG module** that lets users upload documents and
   receive grounded, cited natural-language answers.
4. **Deliver, deploy, and evaluate** a citizen-facing, cloud-hosted web app with unified search,
   filter, browse, and alert functionality, and evaluate its usability, accuracy, and performance
   against defined success criteria.

### 1.5 Scope

- **Sources:** a proof-of-concept over five to six key portals (e.g. Public Service Commission,
  Ministry of Finance, Judicial Service Commission, TU Office of the Controller of Examinations,
  Office of the Prime Minister and Council of Ministers).
- **Categories:** Jobs, Exams, Tenders/Procurement, Policy, and Other.
- **Language:** English and Nepali. The delivered pipeline handles Devanagari more completely than
  originally scoped: the `multilingual-e5-base` embedding model retrieves across Nepali text
  natively, and the scrape-time AI classification/summarisation stage produces **both** an
  English and a Nepali (Devanagari) summary for every notice, translating in either direction as
  needed — this was originally planned as future work but is implemented (see §4.4.3).
- **RAG uploads:** PDF and image documents; no real-time voice interface, no multi-document
  cross-referencing in a single request, no external-source answer verification.
- **Delivery:** a responsive web app for desktop and mobile browsers; no native mobile app.
- **Deployment:** AWS (backend + database + storage) and Vercel (frontend). A test corpus of
  ~200–300 notices across all five categories seeds evaluation.

### 1.6 Potential Benefits

**Tangible.** Single-pane access to notices from many authorities; AI plain-language summaries
that cut reading load; a searchable/filterable database (keyword, category, date, organisation);
an optional RAG module for grounded document Q&A; and subscription alerts by category/keyword.

**Intangible.** Narrowing the urban–rural information gap; increasing transparency and civic
participation; and building public trust in accurate, well-organised e-government services.

**Target users.** Students, job seekers, working professionals/contractors, and system
administrators (who manage crawling pipelines and moderate ingested notices).

**Deliverables.** Account management; keyword/category/date/source search; a unified multi-portal
notice view; an AI summary beside each notice; and subscription/alert management.

### 1.7 Overview of Report

Chapter 2 reviews the domain (e-governance, NLP, RAG, crawling, cloud), surveys similar systems,
and justifies the technology stack. Chapter 3 sets out the Agile/RAD methodology, data-gathering
design, and analysis. Chapter 4 presents the detailed design and the *delivered* implementation
with full diagrams. Chapter 5 reports testing and results. Chapter 6 concludes with a critical
evaluation, limitations, and recommendations.

### 1.8 Project Plan

Delivery followed **Agile/RAD** over two semesters in eight iterative phases:

```mermaid
gantt
    title Project Plan (eight phases over two semesters)
    dateFormat  YYYY-MM-DD
    axisFormat  %b
    section Semester 1 (Investigation)
    P1 Planning & environment        :done, p1, 2025-09-01, 30d
    P2 Crawling module (Crawl4AI)    :done, p2, after p1, 30d
    P3 Cloud data pipeline           :done, p3, after p2, 25d
    P4 AI classify + summarise       :done, p4, after p3, 25d
    section Semester 2 (Implementation)
    P5 Frontend (Next.js)            :done, p5, 2026-01-05, 35d
    P6 RAG module (Qdrant + Gemini/Groq) :done, p6, 2026-01-05, 45d
    P7 Testing & cloud deployment    :active, p7, after p6, 25d
    P8 Documentation & finalisation  :active, p8, after p7, 20d
```

*(Phase status reflects the delivered state: RAG, notice aggregation, and AI
classification/summarisation are all implemented; only subscription-alert delivery remains
unbuilt, and cloud deployment/final documentation are in progress.)* Full timeline in
**Appendix E**.

---

## Chapter 2: Literature Review

### 2.1 Domain Research

#### 2.1.1 Public Notice Management Systems / E-Governance
E-governance is the use of information technology to deliver government services, improve process
performance, and foster transparency and civic engagement (Efthymiou, 2025). Janssen,
Charalabidis, and Zuiderwijk (2012) document a persistent gap between the *technical
accessibility* of open government data and its *usability*, attributing under-use to poor
metadata, irregular publication, and a lack of user-centred design — precisely the deficiencies
observed in Nepal's notice ecosystem. Wirtz, Weyerer, and Geyer (2018) find that AI, properly
governed, can make public information services more accessible and responsive, singling out text
classification, information extraction, and natural-language generation as practical capabilities
— the exact set this project applies.

#### 2.1.2 Document Intelligence and Information Retrieval / NLP
The transformer architecture (Vaswani et al., 2017) underpins modern NLP. Minaee et al. show
transformer classifiers outperform earlier RNN/CNN and feature-engineered methods across
benchmarks. For summarisation, **abstractive** methods (BART, T5) generate fluent, semantically
faithful summaries and are preferred here over extractive selection, because official notices use
formal, procedural language that does not summarise well by sentence extraction (Varade et al.,
2021). The **Hugging Face Transformers** library, with its uniform model interface and CPU
(quantised) inference, is the practical vehicle for both stages.

#### 2.1.3 Retrieval-Augmented Generation (RAG)
RAG (Lewis et al., NeurIPS 2020) grounds language generation in retrieved documents, mitigating
the closed-book limitation of parametric models: a query is embedded, the most semantically
similar chunks are retrieved from a vector store, and a generative model answers using those
chunks as context — reducing hallucination and yielding source-driven answers (Han et al., 2024).
In this system the RAG module is *distinct* from the notice-summarisation pipeline:
summarisation runs once over scraped notices at ingest; RAG runs on demand over user-uploaded
documents.

> **Pivot from the proposal.** The Investigation Report proposed **LangChain + ChromaDB + Ollama**
> for RAG. The delivered system replaces this with a **hand-rolled pipeline** (no LangChain),
> **Qdrant** as the vector store, and a **Gemini-primary / Groq-fallback** dispatcher for LLM
> inference. ChromaDB offers approximate nearest-neighbour search over dense embeddings with a
> file-based backend — adequate for an early prototype — but Qdrant additionally provides **named
> vectors** (dense + sparse in one point), **BM25 hybrid search with server-side RRF fusion**,
> **payload indexes** for per-document filtering, and **deterministic point IDs** for idempotent
> re-embedding. These capabilities are the difference between a demo and a production retriever
> (see §4.4.3). On the LLM side, every generation path (`app/llm.py`) first tries **Gemini 2.0
> Flash** and falls back to **Groq `llama-3.3-70b-versatile`** — round-robining across multiple
> Groq API keys on 429s — only on Gemini failure; an extractive, embedding-similarity fallback
> answers even with no LLM key configured at all.

#### 2.1.4 Web Scraping / Crawling Technologies
Web scraping extracts structured data from websites via HTTP requests and HTML parsing (Khder,
2021). The Investigation Report proposed **Scrapy** (concurrent, rate-limited crawling),
**BeautifulSoup4** (HTML parsing), and **Selenium + ChromeDriver** (JS-rendered pages).

> **Pivot from the proposal.** The delivered design consolidates the crawling/rendering roles into
> **Crawl4AI** — an asynchronous, open-source crawler built on Playwright (`apps/ai/app/scraper.py`).
> One tool renders JavaScript pages *and* fetches static HTML, respects `robots.txt` and rate
> limits, and returns raw HTML for structured extraction or cleaned Markdown for detail pages.
> **BeautifulSoup4 is retained**, repurposed as the parser behind a dynamic schema-detection
> layer rather than the primary crawler: because each admin-added government site has arbitrarily
> different markup, listing extraction cannot be hand-coded per site. Instead, a free heuristic
> pass scores repeating DOM groups (table rows, list items, card grids) by size and CSS-class
> hints to derive a `crawl4ai.JsonCssExtractionStrategy` schema; if that fails, an LLM is shown the
> cleaned HTML once and asked to propose the same kind of schema. Whichever schema succeeds is
> cached on the `ScrapeSource` row so every subsequent run is pure CSS parsing — detection re-runs
> automatically only if a site's markup changes and extraction drops to zero rows. Detail pages are
> always fetched generically (no per-site body selector), with dedicated handling for inline
> PDF-viewer widgets (Mozilla pdf.js, DearFlip flipbooks) so their toolbar chrome is never
> mistaken for notice text. Tesseract OCR (`nep+eng`) remains for scanned PDFs and images, and a
> dedicated parser handles **Bikram Sambat** (Nepali calendar) publication dates, which several
> target portals render natively.

#### 2.1.5 Cloud Computing and Deployment Architecture
Following the NIST definition, cloud computing delivers pooled, on-demand resources with
scalability, reliability, and geographic reach — a natural fit for a nationwide civic service
(Chang & He, 2025). **AWS** hosts the NestJS API and Python AI microservice (EC2), the relational
database (RDS PostgreSQL), and object storage (S3); **Vercel** hosts the Next.js frontend on a
global CDN. The AWS free tier suffices for a proof of concept (Kadaskar & Kamthe, 2024).

### 2.2 Similar Systems

- **2.2.1 Government aggregation platforms** — Australia's *AusTender* and the UK's *GOV.UK*
  publishing platform prove the value of centralised, searchable, subscribable notice
  aggregation — but were built atop mature e-governance with standardised, machine-readable data.
  Nepal's portals lack that standardisation, which is exactly why an *AI-enhanced* aggregation
  layer is needed.
- **2.2.2 AI document-processing platforms** — Adobe Acrobat AI Assistant, Azure Document
  Intelligence, and Google Document AI offer strong OCR/extraction/summarisation but are
  commercial, general-purpose, and cost-prohibitive for a public civic service. An open-source
  stack (Tesseract + Hugging Face + a custom RAG pipeline) delivers comparable capability with no
  licensing cost and full customisability for Nepali portals.
- **2.2.3 Gap identification** — Centralised government portals offer authority but depend on
  government capacity; commercial AI offers capability but not access; research prototypes offer
  innovation but not production readiness. No system combines **aggregation + AI
  classification/summarisation + document Q&A** for Nepalese citizens. That combination is this
  project's contribution.

### 2.3 Technical Research

- **2.3.1 Next.js (React 19, App Router)** — SSR/SSG, file-based routing, strong performance and
  DX, one-click Vercel/CDN deployment.
- **2.3.2 NestJS** — TypeScript-first, Angular-like modular structure (controllers → services →
  data layer), first-class scheduling (`@nestjs/schedule`) for periodic crawl jobs, and
  guard-based JWT auth.
- **2.3.3 Python AI service (raw ASGI / uvicorn)** — a dependency-light service for extraction,
  OCR, chunking, embedding, vector I/O, and LLM prompting. A hand-rolled router keeps the
  footprint tiny (seven routes) and boot instant.
- **2.3.4 PostgreSQL + Prisma ORM** — ACID relational store for users, documents, and metadata;
  Prisma gives type-safe queries and migrations. *(The proposal named TypeORM; the delivery uses
  Prisma.)* Native full-text search (`tsvector`/`tsquery`) serves notice search.
- **2.3.5 Qdrant (vector database)** — named dense (768-d, cosine) + BM25 sparse vectors, RRF
  fusion, keyword payload index on `doc_id`, deterministic point IDs; REST/gRPC; easy Docker dev
  and managed cloud.
- **2.3.6 Embedding & chunking** — `intfloat/multilingual-e5-base` (multilingual, EN + Devanagari,
  512-token window, `query:`/`passage:` prefixes); structure-aware hierarchical chunking
  (paragraph → sentence → word) at 800/120 chars.
- **2.3.7 LLMs for RAG and notice AI** — a single dispatcher (`app/llm.py:_llm_chat`) tries
  **Gemini 2.0 Flash** first via the Generative Language REST API, then falls back to a
  key-rotated pool of **Groq `llama-3.3-70b-versatile`** keys (OpenAI-compatible HTTP call,
  retried on 429/5xx); an embedding-similarity **extractive** fallback answers even with no LLM
  key configured. The same dispatcher powers document RAG answers, notice-chatbot answers,
  per-notice Q&A, conversational chat replies, intent classification, and scrape-time
  summarisation/classification.
- **2.3.8 Turborepo (monorepo)** — one repo, three apps (`web`, `api`, `ai`), shared tooling,
  parallel dev/build with pnpm workspaces.
- **2.3.9 Google OAuth (authentication)** — sign-in via Google; a stable `sub` claim keys the
  `User` record; JWT issued by the API guards all protected routes.

**Table 1 — Technology choices and justification** *(delivered stack)*

| Concern | Choice | Why |
|---|---|---|
| Frontend | Next.js 16 / React 19 | SSR, App Router, Vercel CDN |
| API | NestJS + Prisma | typed, modular, JWT guards, migrations |
| AI service | Python raw ASGI (uvicorn) | zero-framework, tiny footprint |
| Relational DB | PostgreSQL | ACID, full-text search |
| Vector DB | **Qdrant** | hybrid dense+BM25, RRF, payload filters, deterministic IDs |
| Embeddings | `multilingual-e5-base` (768-d) | best free multilingual retriever, EN+Nepali |
| Sparse | `Qdrant/bm25` (fastembed) | exact-identifier keyword matching |
| LLM | **Gemini 2.0 Flash** (primary) + Groq `llama-3.3-70b-versatile` (multi-key fallback) | fast, free-tier quality lead (Gemini) with resilient overflow capacity (Groq key rotation) |
| Crawler | **Crawl4AI** + BeautifulSoup4 (schema detection) | static + JS pages, Markdown/HTML output, robots/rate-limit, per-site CSS schema learning |
| OCR | Tesseract (`nep+eng`) | scanned Nepali notices and PDF attachments |
| Calendar parsing | `nepali-datetime` | Bikram Sambat dates on Nepali government portals |
| Auth | Google OAuth + JWT | no password storage, stable identity |
| Messaging | Evolution API (WhatsApp) | inbound webhook + outbound send for a conversational channel (ack-reply today; alert delivery not yet wired) |

---

## Chapter 3: Methodology

### 3.1 System Development Methodology

#### 3.1.1 Rapid Application Development (RAD) / Agile
The project uses an **Agile/RAD** approach: incremental, iterative delivery with continuous
feedback and working components on a regular cadence, in contrast to rigid waterfall progression.

```mermaid
flowchart LR
    A[Requirements] --> B[Design / Mockups]
    B --> C[Prototype / Build]
    C --> D[User Testing & Feedback]
    D --> E[Refine]
    E --> A
    style C fill:#2563eb,color:#fff
    style D fill:#16a34a,color:#fff
```
*Figure 1 — Agile/RAD delivery cycle.*

#### 3.1.2 Justification for RAD
The system spans technically diverse components — crawling, OCR, NLP models, a cloud API, and a
responsive frontend. Testing one module routinely surfaces constraints affecting another (e.g.
async hand-off between crawl, OCR, inference, and DB writes). Agile enables that discovery without
restarting; its iterative structure also suits the experimental AI stages, whose accuracy can
only be judged against real scraped data and refined over successive phases. **Eight phases**
(§1.8) run across two semesters; the Investigation Report covered Phases 1–4, the implementation
phase delivers Phases 5–8.

### 3.2 Data Gathering Design

Data collection combines **primary** (surveys, interviews) and **secondary** (systematic
crawling) sources; all primary activities received ethics clearance before commencing.

#### 3.2.1 Primary Data Collection
- **Survey** — an online questionnaire targeting ≥30 respondents per target group (students, job
  seekers, professionals, contractors), distributed via university and community networks across
  urban and semi-urban Nepal, to quantify current access behaviour and expectations.
- **Interviews** — ≥3 semi-structured interviews (a student, a professional/contractor, an
  e-governance/IT professional) for depth on behaviour, pain points, and expectations.

#### 3.2.2 Secondary Data Collection (via Crawl4AI)
Crawling target portals serves two ends: proving technical feasibility and seeding the test
corpus. Target sites include **psc.gov.np**, **mof.gov.np**, **jsc.gov.np**, **tucoe.edu.np**,
and **opmcm.gov.np**. Crawl4AI fetches static and JS-rendered pages and returns Markdown;
Tesseract OCR handles scanned PDFs/images. `robots.txt` is honoured, conservative rate limits are
applied, and an explicit user-agent is set. Target: **200–300 notices** across all five
categories.

### 3.3 Analysis of Data

- **3.3.1 Quantitative** — descriptive statistics (frequency distributions, percentages,
  Likert-scale averages) on survey responses: portal-visit frequency, access challenges,
  perceived usefulness of AI summaries, and preferred alert channels — feeding functional-
  requirement prioritisation.
- **3.3.2 Qualitative** — thematic analysis of interview transcripts. Recurring themes:
  time cost of polling many portals, inaccessibility of scanned PDFs, low rural digital literacy
  (need for plain-language summaries), and concern over AI content accuracy/trust.
- **3.3.3 Preliminary user requirements —**

**Table 3 — Functional (FR) and Non-Functional (NFR) requirements**

| ID | Requirement | Priority | Status |
|---|---|---|---|
| FR-01 | Admin-triggered crawling of government portals (Crawl4AI, self-adapting per-site schema) | High | ✅ Delivered |
| FR-02 | OCR text extraction from scanned PDFs (Tesseract) | High | ✅ Delivered |
| FR-03 | Classify each notice: Notice / News / Press Release / Circular / Tender / Vacancy / Other | High | ✅ Delivered |
| FR-04 | AI abstractive summary per notice, English + Nepali (Gemini/Groq) | High | ✅ Delivered |
| FR-05 | Search by keyword, category, date range, source, urgency | High | ✅ Delivered |
| FR-06 | Keyword/category subscription alerts | Medium | ⚠️ Not implemented |
| FR-07 | Upload PDF/image and query it via the RAG module | Medium | ✅ Delivered |
| FR-08 | Unified responsive web UI (desktop + mobile) | High | ✅ Delivered |
| FR-09 | Account registration/login (Google OAuth) | Medium | ✅ Delivered |
| FR-10 | Ask a natural-language question about a specific notice or across the whole notice corpus | Medium | ✅ Delivered |
| NFR-01 | ≥99% availability during crawl/retrieval | High | Not formally measured |
| NFR-02 | Search responses < 3 s under normal load | Medium | ✅ Pass (§5.2.3) |
| NFR-03 | Comply with `robots.txt` of all scraped portals | High | ✅ Delivered (Crawl4AI default) |

---

## Chapter 4: Design and Implementation

> This chapter documents the system **as actually built in this repository**
> (`Personal/public-notice-management`). To keep the account honest, every subsystem is labelled
> with its real status. Both flagship subsystems — **document-intelligence/RAG** and **notice
> aggregation with AI classification/summarisation** — are complete and running end-to-end across
> all three apps. The one subsystem still a genuine placeholder is **subscription/alert
> delivery**.

**Implementation status (what is in the codebase today).**

| Subsystem | Status | Where in the repo |
|---|---|---|
| Google OAuth + JWT auth (roles `user`/`admin`) | ✅ **Delivered** | `apps/api/src/{modules,services,controllers}/auth*`, `guards/`, `strategies/` |
| Document management (upload, list, download, delete, embed/unembed) | ✅ **Delivered** | `apps/api/src/services/documents.service.ts` |
| Document RAG pipeline (extract → OCR → chunk → embed → Qdrant hybrid → Gemini/Groq) | ✅ **Delivered** | `apps/ai/app/{extractor,chunker,embeddings,store,rag,llm}.py`, `apps/api/src/services/rag.service.ts` |
| RAG chat UI (Library / Split / Chat, live progress) | ✅ **Delivered** | `apps/web/app/documents/page.tsx` |
| Notice aggregation / crawling (**Crawl4AI**, heuristic + LLM schema auto-detection, BS-date parsing, attachment/PDF-viewer discovery) | ✅ **Delivered** | `apps/ai/app/scraper.py` |
| Notice classification & summarisation (urgency, category, key facts, tags, EN+NE summaries, run concurrently during scrape) | ✅ **Delivered** | `apps/ai/app/scraper.py` (`_summarize_item`), `apps/ai/app/llm.py` (`analyze_notice`) |
| Admin scraping console (source CRUD, trigger run, live run-progress polling, scraped-item browser, run history) | ✅ **Delivered** | `apps/api/src/{controllers,services}/scraping.*`, `apps/web/app/admin/{scraping,sources}` |
| Notice persistence & public API (search, category/date/urgency filters, per-notice detail with lazy PDF extraction, per-notice Q&A) | ✅ **Delivered** | `apps/api/prisma/schema.prisma` (`ScrapeSource`/`ScrapedItem`/`Attachment`/`ScrapeRun`), `apps/api/src/{controllers,services}/notices.*` |
| Notice search chatbot (hybrid PostgreSQL keyword + Qdrant semantic + LLM synthesis) | ✅ **Delivered** | `apps/ai/app/notice_rag.py`, `apps/ai/app/notice_store.py`, `apps/web/components/floating-chat.tsx` |
| WhatsApp conversational channel (Evolution API webhook + send) | ✅ **Delivered**, ack-reply only | `apps/api/src/webhooks/whatsapp-webhook.*` |
| Notifications / subscription alerts | ⚠️ **Placeholder** (controller and service are empty files — 0 bytes) | `apps/api/src/{controllers,services}/notifications*` |

Read this chapter with that legend in mind: ✅ = working end-to-end (backend logic, persistence,
and a wired frontend, verified by reading the actual route/service code, not just the UI), ⚠️ =
placeholder only. The delivered system covers document RAG, multi-site notice aggregation with AI
enrichment, a public notice browser with two independent AI Q&A surfaces (per-notice ask, and a
portal-wide hybrid-search chatbot), an admin scraping console, authentication, and a WhatsApp
inbound channel. Subscription/alert *delivery* (the mechanism that would push a WhatsApp/email
message when a matching new notice appears) is the one designed-but-unbuilt piece.

### 4.1 Design

#### 4.1.1 System Architecture (Monorepo: Web + API + AI Service)

The system is a **Turborepo monorepo** with three single-responsibility services. The browser
never talks to the AI service directly — everything is proxied through NestJS, which enforces JWT
auth and keeps the AI service private.

```mermaid
flowchart TB
    subgraph Client
      W["apps/web — Next.js 16 / React 19<br/>/documents (RAG), /notices, /dashboard, /admin"]
    end
    subgraph Server
      A["apps/api — NestJS + Prisma<br/>auth · documents · rag · notices ✅<br/>scraping (admin) · webhooks ✅<br/>notifications ⚠️"]
      AI["apps/ai — Python raw ASGI<br/>extract · chunk · embed · query ✅<br/>scrape · analyze · notice search ✅"]
    end
    subgraph Data
      PG[("PostgreSQL<br/>users, documents,<br/>scrape sources/items/runs")]
      QD[("Qdrant<br/>documents + notices<br/>dense + BM25 vectors")]
      S3[("AWS S3<br/>document files")]
    end
    subgraph External
      LLM["Gemini 2.0 Flash (primary)<br/>Groq llama-3.3-70b (fallback)"]
      OAUTH["Google OAuth"]
      WA["Evolution API<br/>(WhatsApp) ✅ ack-reply"]
      GOV["Gov portals<br/>(Crawl4AI ✅ delivered)"]
    end
    W -- "HTTPS + JWT" --> A
    A -- "HTTP (private)" --> AI
    A --> PG
    A --> S3
    A -. OAuth .-> OAUTH
    A <-. webhook / send .-> WA
    AI --> QD
    AI --> LLM
    GOV -. scrape .-> AI
    style W fill:#0ea5e9,color:#fff
    style A fill:#e11d48,color:#fff
    style AI fill:#7c3aed,color:#fff
```
*Figure 2 — High-level system architecture. ✅ delivered · ⚠️ placeholder.*

**Division of responsibility.**

| Layer | Owns | Does NOT own |
|---|---|---|
| `apps/web` | UX: upload, embed toggle, live progress, chat rendering, notice browse/search/filter, admin scraping console | Any AI logic |
| `apps/api` | Auth, source-of-truth `Document`/`ScrapeSource`/`ScrapedItem`/`ScrapeRun` records, file storage, proxying to AI, per-source run locking | Vectors, embeddings, LLM calls, crawling itself |
| `apps/ai` | Extraction, OCR, chunking, embeddings, Qdrant (documents + notices), crawling, schema detection, LLM prompting, progress | Auth, relational-metadata persistence |

**Data-flow diagram (Level 0 / Level 1).**

```mermaid
flowchart LR
    GOV[/"Gov Portals"/] -->|HTML/PDF/img| P1((1. Crawl, OCR &<br/>schema detection))
    P1 --> P2((2. Classify &<br/>Summarise EN+NE))
    P2 --> PG[(PostgreSQL)]
    P2 -.-> QD[(Qdrant<br/>notice vectors)]
    U[/"User"/] -->|search/filter/ask| P3((3. Notice<br/>Search & View))
    P3 --> PG
    P3 --> QD
    U -->|upload + question| P4((4. Document<br/>RAG Q&A))
    P4 --> QD
    P4 --> LLM[/"Gemini/Groq"/]
    ADM[/"Admin"/] -->|manage sources, run| P5((5. Admin &<br/>Monitoring))
    P5 --> PG
    U -.->|subscribe — planned| P6((6. Alerts<br/>not yet built))
    P6 -.-> PG
```
*Figure 3 — DFD. Level 0 external entities: government portals, users, administrators, alert
service (planned). Level 1 processes: crawl+OCR+schema-detect, classify+summarise, search/view,
document RAG Q&A, admin, alerts (dashed = not yet implemented).*

**Deployment.**

```mermaid
flowchart TB
    subgraph Vercel[Vercel CDN]
      WEB[Next.js frontend]
    end
    subgraph AWS
      EC2A[EC2 — NestJS API]
      EC2B[EC2 — Python AI service]
      RDS[(RDS PostgreSQL)]
      S3[(S3 files)]
      QDC[(Qdrant — Docker/managed)]
    end
    GROQ[Groq API]
    WEB -->|HTTPS| EC2A
    EC2A --> EC2B
    EC2A --> RDS
    EC2A --> S3
    EC2B --> QDC
    EC2B --> GROQ
```
*Figure 12 — Deployment diagram.*

#### 4.1.2 Use-Case Diagram and Specifications

```mermaid
flowchart LR
    Guest((Guest)); User((Registered User)); Admin((Admin))
    Guest --- UC1[Browse & search notices]
    Guest --- UC2[Sign in with Google]
    User --- UC1
    User --- UC3[View AI summary]
    User --- UC4[Upload document]
    User --- UC5[Ask RAG question]
    User --- UC6[Toggle embed / re-embed]
    User --- UC7[Subscribe to alerts]
    Admin --- UC8[Manage crawl sources]
    Admin --- UC9[Moderate notices]
    Admin --- UC10[Monitor system health]
```
*Figure 4 — Use-case diagram.*

**Sample specification — UC5 "Ask RAG question."**
*Precondition:* user authenticated; ≥1 document `INDEXED`. *Main flow:* user types a question →
API `POST /rag/query` (JWT) → AI routes intent → embeds query → hybrid Qdrant search → threshold
+ dedupe → Groq generates a cited Markdown answer → sources rendered as chips. *Alternate:* chat
intent → conversational reply, no retrieval. *Exception:* no chunk above threshold → honest
"not found" reply; Groq unavailable → extractive fallback.

#### 4.1.3 Class / Domain Diagram

```mermaid
classDiagram
    class User { +uuid id; +string googleId; +string email; +string name; +Role role; +UserStatus status; +datetime lastLoginAt }
    class Document { +uuid id; +string title; +string filename; +string mimeType; +int fileSize; +string filePath; +DocumentStatus status; +bool isOcr; +int textLength; +int chunkCount; +datetime indexedAt }
    class ScrapeSource { +uuid id; +string name; +string baseUrl; +string noticeListUrl; +string newsListUrl; +json noticeSchema; +ScrapePaginationType paginationType; +int maxPages; +bool enabled; +datetime lastRunAt; +ScrapeRunStatus lastStatus }
    class ScrapedItem { +uuid id; +ScrapedItemCategory category; +string title; +string sourceUrl; +string contentText; +string aiSummary; +string aiSummaryNe; +string aiUrgency; +float aiCategoryConfidence; +json keyFacts; +json tags; +json metadata; +int views }
    class ScrapeRun { +uuid id; +ScrapeRunStatus status; +int itemsFound; +int itemsNew; +int itemsSummarized; +string error; +datetime startedAt; +datetime finishedAt }
    class Attachment { +uuid id; +string url; +string mimeType; +int sizeBytes; +string label }
    User "1" --> "*" Document : uploads
    ScrapeSource "1" --> "*" ScrapedItem : produces
    ScrapeSource "1" --> "*" ScrapeRun : logs
    ScrapedItem "1" --> "*" Attachment : has
```
*Figure 5 — Domain/class diagram (derived from the Prisma schema). The notice-aggregation models
(`ScrapeSource`, `ScrapedItem`, `ScrapeRun`, `Attachment`) are fully delivered, not a design-only
addition.*

#### 4.1.4 Activity Diagram — Document Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING : upload
    PENDING --> PROCESSING : AI accepts
    PROCESSING --> INDEXED : 201 from AI
    PROCESSING --> FAILED : pipeline error
    INDEXED --> UNEMBEDDED : POST /unembed
    UNEMBEDDED --> PROCESSING : POST /embed
    FAILED --> PROCESSING : POST /embed (retry)
    INDEXED --> [*] : delete
```
*Figure 6 — Document lifecycle. Invariants: the uploaded file stays on disk until the row is
deleted (enabling unembed→re-embed without re-upload); PostgreSQL is the source of truth for
status, Qdrant only stores vectors.*

#### 4.1.5 Sequence Diagrams

**Ingestion (upload → vectors).** The upload request returns immediately (`PENDING`); processing
continues server-side, so a large OCR'd PDF never holds the browser's HTTP request open.

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as NestJS
    participant AI as Python AI
    participant Q as Qdrant
    B->>N: POST /documents (multipart)
    N->>N: multer saves file; prisma.create()
    N-->>B: 201 {status: PENDING}
    N->>AI: POST /documents (file + document_id + title)
    AI->>AI: extract (pypdf/OCR)
    AI->>AI: chunk (800/120)
    AI->>AI: embed (batch 32, e5)
    loop poll
      B->>N: GET /documents/progress/batch?ids=
      N->>AI: GET /progress?ids=
      AI-->>N: {stage, percent}
      N-->>B: progress
    end
    AI->>Q: upsert points (dense + bm25)
    AI-->>N: 201 {chunk_count, text_length, is_ocr}
    N->>N: status = INDEXED
```
*Figure 7 — Ingestion sequence.*

**Query (question → cited answer).**

```mermaid
sequenceDiagram
    participant B as Browser
    participant N as NestJS
    participant AI as Python AI
    participant Q as Qdrant
    participant L as Gemini/Groq
    B->>N: POST /rag/query {question}
    N->>AI: POST /query
    AI->>AI: intent routing (lexical→semantic→LLM)
    alt chat intent
      AI-->>N: conversational reply (no sources)
    else document question
      AI->>AI: embed question (query: prefix)
      AI->>Q: hybrid search (dense + bm25, RRF)
      Q-->>AI: candidates + dense vectors
      AI->>AI: cosine re-score, threshold, dedupe
      AI->>L: chat (context + question) — Gemini first, Groq on failure
      L-->>AI: cited Markdown answer
      AI-->>N: {answer, sources, model_used}
    end
    N-->>B: answer + source chips
```
*Figure 8 — Query sequence.*

**Notice search (portal-wide chatbot).** A parallel query path exists for the public notices
feature: the floating chat widget calls `POST /notices/search`, which first runs a PostgreSQL
`ILIKE` keyword search over `ScrapedItem` (fast, free), forwards those rows to the AI service,
which uses them directly if present or falls back to a dense-only semantic search against the
separate `notices` Qdrant collection, then synthesizes an answer the same way as document RAG.
`POST /notices/:id/ask` is a lighter-weight sibling — it skips retrieval entirely and answers
directly from one notice's already-fetched content.

**Scrape run (admin-triggered aggregation).** Triggering a source returns a `runId` immediately;
the crawl itself — potentially dozens of detail-page fetches plus concurrent AI summarisation —
runs detached, with the admin console polling live status messages.

```mermaid
sequenceDiagram
    participant Ad as Admin (browser)
    participant N as NestJS
    participant AI as Python AI
    participant Gov as Gov portal
    participant L as Gemini/Groq
    Ad->>N: POST /admin/scraping/sources/:id/run
    N->>N: create ScrapeRun (RUNNING); lock source
    N-->>Ad: 200 {runId}
    N->>AI: POST /scrape/source {base_url, category_urls,<br/>cached_schemas, known_urls, run_id}
    AI->>AI: resolve schema (cached → heuristic → LLM)
    loop each listing page
      AI->>Gov: fetch listing (Crawl4AI)
      AI->>AI: extract rows via CSS schema; stop early if<br/>all rows already known
      AI->>Gov: fetch detail page per new row
      AI->>L: summarize + classify + tag (concurrent, semaphore=2)
    end
    AI-->>N: {items[], schemas_used}
    loop Ad polls
      Ad->>N: GET /admin/scraping/runs/:id/progress
      N->>AI: GET /scrape/progress/:runId
      AI-->>N: {stage, messages[]}
      N-->>Ad: progress
    end
    N->>N: upsert ScrapedItem rows (dedupe by source_url,<br/>skip unchanged via content_hash); cache schema on ScrapeSource
    N->>AI: POST /notices/embed (fire-and-forget)
    N->>N: ScrapeRun -> SUCCESS/FAILED; unlock source
```
*Figure 8b — Notice-aggregation scrape-run sequence.*

### 4.2 Database Design

#### 4.2.1 Entity-Relationship Diagram (PostgreSQL)

```mermaid
erDiagram
    USERS ||--o{ DOCUMENTS : uploads
    SCRAPE_SOURCES ||--o{ SCRAPED_ITEMS : produces
    SCRAPE_SOURCES ||--o{ SCRAPE_RUNS : logs
    SCRAPED_ITEMS ||--o{ ATTACHMENTS : has
    USERS {
      uuid id PK
      string google_id UK
      string email UK
      string name
      enum role
      enum status
      datetime last_login_at
    }
    DOCUMENTS {
      uuid id PK
      string title
      string filename
      string mime_type
      int file_size
      string file_path
      enum status
      bool is_ocr
      int text_length
      int chunk_count
      uuid uploaded_by FK
      datetime indexed_at
    }
    SCRAPE_SOURCES {
      uuid id PK
      string name
      string base_url
      string notice_list_url
      string news_list_url
      string press_release_list_url
      json notice_schema
      enum pagination_type
      int max_pages
      bool enabled
      datetime last_run_at
      enum last_status
    }
    SCRAPED_ITEMS {
      uuid id PK
      uuid source_id FK
      enum category
      string title
      string source_url UK
      string content_text
      string ai_summary
      string ai_summary_ne
      string ai_urgency
      float ai_category_confidence
      json key_facts
      json tags
      json metadata
      string content_hash
      int views
    }
    SCRAPE_RUNS {
      uuid id PK
      uuid source_id FK
      enum status
      int items_found
      int items_new
      int items_summarized
      string error
      datetime started_at
      datetime finished_at
    }
    ATTACHMENTS {
      uuid id PK
      uuid item_id FK
      string url
      string mime_type
      int size_bytes
      string label
    }
```
*Figure 9 — ER diagram (from `apps/api/prisma/schema.prisma`).*

**Table 4 — Prisma data model summary**

| Model | Purpose | Key relations |
|---|---|---|
| `User` | Google-authenticated accounts (role, status) | 1→N `Document` |
| `Document` | Source-of-truth metadata + lifecycle status | N→1 `User` |
| `ScrapeSource` | Admin-configured government site: listing URLs, cached CSS extraction schema per category, pagination config | 1→N `ScrapedItem`, 1→N `ScrapeRun` |
| `ScrapedItem` | One scraped notice/news/press-release/tender/vacancy: raw content + AI enrichment (summary EN/NE, urgency, key facts, tags, structured metadata) | N→1 `ScrapeSource`, 1→N `Attachment` |
| `ScrapeRun` | One execution of a scrape job (counts, status, error) for the admin logs view | N→1 `ScrapeSource` |
| `Attachment` | A downloadable file (PDF/doc/image) discovered on a scraped item's page | N→1 `ScrapedItem` |

The `Document.status` enum (`PENDING/PROCESSING/INDEXED/UNEMBEDDED/FAILED`) drives the lifecycle
in Figure 6; `chunkCount`, `textLength`, `isOcr`, and `indexedAt` are written back after the AI
service reports success.

#### 4.2.2 Document Structure (Qdrant Collection)

The `documents` collection uses **named vectors**: a dense vector (768-d, cosine) for semantic
similarity and a **BM25 sparse** vector for keyword matching, plus a keyword payload index on
`doc_id` so per-document filtering stays fast as the corpus grows.

```mermaid
flowchart TB
    subgraph Collection["Qdrant collection: documents"]
      direction TB
      V["vectors_config:<br/>dense = 768-d, COSINE"]
      SP["sparse_vectors_config:<br/>bm25 (IDF modifier)"]
      IDX["payload_index:<br/>doc_id = KEYWORD"]
    end
    subgraph Point["Point (one per chunk)"]
      PID["id = uuid5(doc_id : chunk_index)"]
      DV["vector.dense = e5 embedding"]
      BV["vector.bm25 = sparse (indices, values)"]
      PL["payload {doc_id, chunk_index, content,<br/>char_start, char_end, title, filename, mime}"]
    end
    Collection --> Point
```
*Figure 10 — Qdrant collection & point schema.*

**Table 5 — Point payload fields**

| Field | Purpose |
|---|---|
| `doc_id` | Postgres UUID; per-document filter, count, and delete |
| `chunk_index` | ordinal within the document |
| `content` | the chunk text (returned at query time) |
| `char_start` / `char_end` | position in the source text |
| `title` | source label shown in the chat UI |
| `original_filename`, `mime_type` | provenance |

**Deterministic IDs** (`uuid5(doc_id:index)`) make re-embedding an idempotent upsert — no
delete-then-insert race. **Schema self-healing:** on startup `ensure_collection()` validates the
dense dimension and sparse presence against config; on mismatch (e.g. a model change) it
recreates the collection and documents are re-embedded from the still-on-disk files.

**A second, simpler collection for notices.** `app/notice_store.py` maintains an independent
`notices` collection — one **dense-only** vector per notice (title + AI summary concatenated,
same `multilingual-e5-base` embedding), used purely as a semantic fallback when the primary
PostgreSQL keyword search (`ScrapedItem` `ILIKE` matching) returns nothing useful for a chatbot
question. It intentionally omits BM25/hybrid fusion — notice summaries are short and the
keyword layer already covers exact-term recall, so the added complexity of a second hybrid
pipeline was not justified here.

#### 4.2.3 Vector Embedding Schema
Embeddings come from `intfloat/multilingual-e5-base` (768-d, L2-normalised so cosine = dot
product). E5 requires asymmetric prefixes — indexed chunks as `passage: …`, questions as
`query: …` — applied automatically. Chunks are 800 chars with 120-char word-boundary overlap
(≈200 tokens, inside the 512-token window). Batching (32 per `encode()`) bounds memory and drives
the progress bar.

### 4.3 Interface Design

- **4.3.1 Dashboard layout** — an app-shell (`h-dvh`) with a sidebar and internally scrolling
  panels; theme-aware, responsive.
- **4.3.2 Notice browsing interface** (`apps/web/app/notices`) — a live, backend-wired
  searchable/filterable list (category, source, date range, urgency, keyword) fetched via
  `fetchNotices()`/`apiFetch` against `GET /notices`; each card shows the AI-generated urgency
  badge and English summary, a per-notice detail page lazily triggers PDF extraction/AI analysis
  if not yet cached, and a floating chat widget (`components/floating-chat.tsx`) answers portal-wide
  questions via the hybrid notice-search endpoint. Bookmarking ("saved notices") is the only piece
  still using client-side `local-store` — the notice data itself is server-sourced.
- **4.3.3 RAG query interface** — the `/documents` page: a **Library** panel (upload, per-document
  embed toggle, live progress bar) and a **Chat** panel (Markdown answers with grouped source
  chips). Desktop offers a Library/Split/Chat view switcher; mobile collapses to one panel with a
  bottom tab bar.
- **4.3.4 Admin panel** — a live **scraping console** (`apps/web/app/admin/scraping`,
  `apps/web/app/admin/sources`) backed end-to-end by `admin/scraping/*`: add/edit/delete sources,
  trigger a run with per-category selection, watch live run-progress messages, browse/delete
  scraped items, and inspect run history — plus notice moderation and health monitoring.

### 4.4 Execution

- **4.4.1 Logo and branding** — the product is branded **"Suchana AI"** (*सूचना*, "notice").
- **4.4.2 User manual** — sign in with Google → upload a PDF/image → wait for `INDEXED` → ask
  questions in the chat; toggle a document off to remove its vectors (the file is kept) and back
  on to re-embed.

#### 4.4.3 Best Features (delivered)

**RAG-based document querying (the flagship).** A three-tier **intent router** first decides
whether a message is even a document question — a free lexical squeeze-match
(`"Helllloooooo"`→`"helo"`), then a semantic prototype comparison reusing the query embedding,
then (only for ambiguous cases) a one-word Groq tiebreak. Greetings get a conversational reply
with no retrieval; document questions proceed to hybrid search.

**Hybrid retrieval with RRF fusion + cosine re-scoring.** Dense embeddings capture meaning but
miss exact identifiers (notice numbers, dates, names); BM25 is the opposite. Qdrant runs both
legs and fuses them with Reciprocal Rank Fusion, then each hit is re-scored with true cosine so
the score threshold and UI relevance percentages remain meaningful.

```mermaid
flowchart LR
    Q[Question] --> E[Embed<br/>query: prefix]
    E --> D[Dense prefetch<br/>top_k×2]
    Q --> BM[BM25 sparse prefetch<br/>top_k×2]
    D --> RRF{RRF fusion}
    BM --> RRF
    RRF --> RS[Cosine re-score]
    RS --> TH[Threshold ≥ 0.78]
    TH --> DD[Dedupe near-duplicates]
    DD --> CTX[Top-k context]
    CTX --> LLM[Groq llama-3.3-70b]
    LLM --> ANS[Cited Markdown answer]
    CTX -. no API key .-> FB[Extractive fallback]
```
*Figure 11 — Hybrid retrieval + RRF fusion pipeline.*

**PDF ingestion, OCR, and structure-aware chunking.** A text-density heuristic (<100 chars/page →
OCR) routes born-digital PDFs through fast `pypdf` and scans through Tesseract (`nep+eng`).
Chunking is hierarchical (paragraph → sentence → word) with word-boundary overlap.

**Qdrant vector search integration.** Named dense+sparse vectors, payload-filtered per-document
search ("Ask AI about this document"), deterministic-ID upserts, and auto-recreate on schema
change.

**Grounded generation with graceful degradation.** Every LLM path — answer, chat reply,
"no-results" reply, intent tiebreak — flows through one hardened `httpx` helper (one retry,
guarded parse, `<think>` strip). Missing key / exhausted retries fall back to an **extractive**
answer, always visible in the UI (amber banner).

**WhatsApp conversational channel (delivered).** A NestJS webhook
(`POST /webhooks/whatsapp`) receives Evolution API events (`messages.upsert`,
`connection.update`, …) and `WhatsappService` sends replies via the Evolution REST API. Today it
handles inbound messages with an acknowledgement auto-reply; it is the delivered foundation for
the *(planned)* subscription-alert delivery, giving citizens a low-bandwidth channel that does
not require opening the web app.

**Multi-site notice aggregation with self-adapting extraction (delivered).** Rather than one
crawler per government site, `scraper.py` learns each site's listing markup: a free heuristic
scores repeating DOM groups by size and class-name hints (deprioritising nav/footer/sidebar
chrome), and — only when heuristics fail — an LLM is shown the cleaned HTML once and asked to
propose a CSS extraction schema. Whichever schema succeeds is cached on the `ScrapeSource` row,
so a source that has already been profiled scrapes with **zero** LLM calls on every subsequent
run; detection re-triggers automatically only if a run against the cached schema yields zero rows
(the site's markup changed).

```mermaid
flowchart LR
    L[Listing page] --> C{Cached schema<br/>on ScrapeSource?}
    C -->|yes, rows>0| X[Extract via cached CSS schema]
    C -->|no / 0 rows| H[Heuristic: score repeating<br/>DOM groups]
    H -->|found| X
    H -->|not found| LLM[LLM: propose CSS schema<br/>from cleaned HTML]
    LLM --> X
    X --> D[Per-row: resolve category by<br/>URL slug, fetch detail page]
    D --> S[Concurrent AI summarize:<br/>summary EN/NE, urgency,<br/>category, key facts, tags]
    S --> DB[(ScrapedItem)]
```
*Figure 11b — Self-adapting listing-schema detection and enrichment pipeline.*

**Nepali-aware content extraction.** Government portals mix Gregorian and **Bikram Sambat**
(Devanagari) dates in the same publication stream — the scraper's BS-date parser handles both
month-first and day-first token orders across a lookup of Nepali month-name spelling variants,
converting to a normalised ISO date via `nepali_datetime`. Detail pages that embed the notice as
an inline PDF viewer (Mozilla pdf.js, DearFlip flipbooks) are detected by DOM signature so their
toolbar/loading-bar chrome is never scraped as if it were the notice body; the real PDF is instead
discovered — from an anchor, a path-hint (`/download/`, `/uploads/`, …), or a JS-embedded
`var pdf = '...'` viewer source — and queued for OCR/text extraction.

**Concurrent AI enrichment during scraping, not after.** Each newly discovered item's
summarisation (English + Nepali summaries, urgency, category classification with a confidence
score, key facts, tags) runs as soon as its detail page is fetched, under a semaphore-bounded
concurrency of 2, so a scrape of dozens of new notices doesn't serialise on LLM round-trips; the
NestJS side tracks `itemsSummarized`/`itemsSummaryFailed` per run for observability. Successfully
summarised notices are embedded into the separate `notices` Qdrant collection in the background
immediately after a run completes, so they become searchable by the portal-wide chatbot without a
manual step.

**Role-based access control** (Google OAuth + JWT guards; `user`/`admin` roles) and
**multi-language support** (`lib/language-context.tsx`; the e5 model retrieves across
English/Nepali; notice summaries are generated in both languages at ingest time).

**Table 6 — Optimisation catalogue (selected)**

| Optimisation | Problem solved |
|---|---|
| Async ingestion (return `PENDING`) | Browser timeouts on large/OCR documents |
| Worker-thread pipeline (`asyncio.to_thread`) | CPU embedding froze the single-process event loop |
| Batched embedding (32) & upserts (100) | Unbounded memory; no progress signal |
| Deterministic point IDs | Duplicate vectors / delete-insert races on re-embed |
| Batched progress endpoint (1 req/tick) | Poll flood (N docs × 2 s × DB+proxy hop) |
| Over-fetch → threshold → dedupe | Weak/duplicate chunks wasting LLM context |
| Word-boundary chunk overlap | Chunks starting mid-word polluting retrieval |
| Hybrid dense + BM25 + RRF | Dense missing exact identifiers |
| Cosine re-score after fusion | RRF rank scores breaking threshold + UI % |
| E5 query/passage prefixes | Un-prefixed embeddings degrading retrieval |
| Three-tier intent router | Greetings hitting vector search |
| Collection validation + auto-recreate | Dimension mismatch after model change |
| Cached per-source CSS schema (heuristic → LLM, cached on re-detect) | Re-paying LLM/heuristic cost on every scrape run |
| Content-hash dedup (`sha256(title+content)`) on upsert | Re-storing unchanged notices as spurious updates |
| Known-URL check + early pagination stop | Wasted crawls of already-scraped listing pages |
| Per-source run lock (`runningSourceIds` set) | Two concurrent runs against the same site corrupting schema cache/counts |
| Semaphore-bounded concurrent summarisation (2) | Serial LLM calls stalling a multi-item scrape |
| Gemini-primary / Groq-fallback with multi-key rotation | Single-provider outage or single-key rate limit stalling all LLM paths |
| PDF-viewer DOM-signature detection | Viewer chrome (toolbar/"Loading PDF Worker…") scraped as notice body |
| Bikram Sambat date parser | Nepali-calendar dates on gov portals failing to parse as `null` |

---

## Chapter 5: Result and Discussion

### 5.1 Testing Design and Plan

- **5.1.1 Prototype testing** — iterative usability checks on the `/rag` Library/Chat UI at each
  Agile increment (upload, progress, toggle, chat rendering, source chips).
- **5.1.2 Unit testing** — targeted tests for the pure functions most prone to regression:
  the chunker (segment sizes, overlap word-boundary snapping, Devanagari danda splitting), the
  intent router (squeeze-match, prototype margins), and payload/ID construction.

### 5.2 System Testing and Discussion

**Table 7 — Test matrix (representative)**

| # | Area | Scenario | Expected | Result |
|---|---|---|---|---|
| T1 | Functional | Upload born-digital PDF | `INDEXED`, `is_ocr=false`, chunks>0 | Pass |
| T2 | Functional | Upload scanned image PDF | OCR path, `is_ocr=true` | Pass |
| T3 | RAG accuracy | Ask factual question with answer in doc | Correct, cited answer | Pass |
| T4 | RAG accuracy | Ask question *not* in docs | Honest "not found" | Pass |
| T5 | Intent | Send "Helllloooo" | Chat reply, no sources | Pass |
| T6 | Hybrid | Query exact notice number | BM25 leg surfaces exact chunk | Pass |
| T7 | Performance | Vector search latency | < 3 s (NFR-02) | Pass |
| T8 | Integration | Web→API→AI round trip via JWT | 200 + answer | Pass |
| T9 | Lifecycle | Unembed then re-embed | Idempotent upsert, same IDs | Pass |
| T10 | Degradation | No LLM key configured | Extractive fallback + banner | Pass |
| T11 | Scraping | Run a source twice concurrently | Second call rejected (409, source locked) | Pass |
| T12 | Scraping | Re-run a source with no new listing rows | 0 new items, pagination stops early | Pass |
| T13 | Scraping | Schema drift (site markup changes) | Cached schema yields 0 rows → auto re-detect | Pass |
| T14 | Scraping | Notice with BS (Bikram Sambat) publish date | Correctly parsed to ISO date | Pass |
| T15 | Scraping | Detail page is a pdf.js/DearFlip viewer | Toolbar text excluded; real PDF queued for OCR | Pass |
| T16 | Notice AI | Newly scraped notice with content | `aiSummary`, `aiSummaryNe`, `aiUrgency`, `tags` populated | Pass |
| T17 | LLM resilience | Gemini call fails/errors | Falls back to Groq automatically | Pass |

- **5.2.1 Functional testing** — upload, extraction (born-digital vs OCR), chunk/embed/index,
  toggle, delete — all lifecycle transitions in Figure 6.
- **5.2.2 RAG query-accuracy testing** — grounding and citation correctness; the 0.78 cosine
  threshold rejects noise (E5 compresses scores into ~0.7–0.9; irrelevant hits ~0.76–0.78,
  relevant ≥0.82).
- **5.2.3 Performance testing** — vector-search latency under normal load against NFR-02 (< 3 s).
- **5.2.4 Integration testing** — Web ↔ API ↔ AI, including the batched progress endpoint and JWT
  enforcement.
- **5.2.5 User-acceptance testing** — target-group participants exercise search, summaries, and
  the RAG chat; feedback feeds the next Agile increment.

**Discussion.** Both the document-RAG and notice-aggregation subsystems meet their functional and
performance targets. The ChromaDB→Qdrant pivot proved decisive: hybrid search materially improved
recall of exact identifiers that dense-only retrieval missed, and deterministic IDs made the
embed/unembed toggle trivially correct. The Crawl4AI decision simplified the aggregation pipeline
by collapsing the crawling/rendering role into one Markdown/HTML-capable tool, while
BeautifulSoup4 was repurposed rather than discarded — it now drives the heuristic listing-schema
detector that lets one generic scraper serve many differently structured government sites without
per-site code. The Gemini-primary/Groq-fallback LLM pivot reduced both cost and single-provider
risk across every AI surface (document RAG, notice classification/summarisation, notice chat,
per-notice Q&A).

---

## Chapter 6: Conclusion

### 6.1 Critical Evaluation
The project delivers a working, end-to-end system covering **both** of its stated pillars: a
production-grade document-intelligence RAG pipeline (Qdrant hybrid search + Gemini/Groq
generation) *and* a self-adapting multi-site notice-aggregation pipeline (Crawl4AI crawling,
heuristic/LLM schema detection, Bikram Sambat-aware parsing, concurrent AI
classification/summarisation in English and Nepali), fronted by a polished, responsive UI —
including a live admin scraping console — and a secure, JWT-guarded API, with Google OAuth and a
WhatsApp (Evolution API) inbound channel. The ChromaDB→Qdrant pivot was justified by concrete
capability gains (hybrid retrieval, payload filtering, deterministic upserts); the
Scrapy/Selenium→Crawl4AI decision, plus repurposing BeautifulSoup4 as a schema-detection parser
rather than the primary crawler, let one generic scraper serve arbitrarily different government
site markups; and the Groq-only→Gemini-primary/Groq-fallback pivot improved answer quality and
resilience across every AI surface in the system. The report is deliberately explicit (§4
implementation-status table) about what is delivered code versus the one remaining placeholder —
subscription/alert delivery — so the contribution is not overstated.

### 6.2 Limitations
1. **No streaming answers** — the UI waits for the full LLM response; SSE would cut perceived
   latency.
2. **No conversation memory** — follow-up questions (in document RAG or notice chat) lose their
   referent.
3. **No cross-encoder reranker** — a reranker over the ~15 candidates would lift top-5 precision
   in both the document and notice retrieval paths.
4. **Character-based chunking** — token-aware chunking would reduce truncation loss.
5. **In-memory progress** (document ingestion *and* scrape-run status) — lost on AI service
   restart (mitigated by periodic list/status refresh).
6. **Single-process ingestion and scraping** — one document embeds at a time per worker, and each
   scrape run holds a simple in-process lock rather than a distributed one; a job queue would add
   true parallelism, retries, and multi-instance safety.
7. **Subscription/alert delivery is not implemented** — `notifications.controller.ts` and
   `notifications.service.ts` are empty files. The WhatsApp channel already receives and replies
   to inbound messages, and notices are already classified/tagged/summarised with structured
   metadata (deadlines, urgency) that a future alert-matching job could consume directly — but no
   such job, subscription model, or outbound alert trigger exists yet.
8. **Notice search recall is keyword-first** — the notice chatbot only falls back to the
   dense-only `notices` Qdrant collection when PostgreSQL `ILIKE` returns nothing; it does not run
   hybrid dense+BM25 fusion the way document RAG does, so paraphrased (non-keyword-overlapping)
   notice questions rely entirely on that fallback path's dense-only recall.
9. **Schema-detection heuristics are English/Latin-script-biased** — the row-hint keyword list
   (`row`, `item`, `card`, …) and LLM schema prompt are in English; a site with purely
   Devanagari-labelled markup classes could reduce heuristic scoring accuracy (an LLM-fallback
   still generally recovers a working schema).

### 6.3 Recommendations
Add SSE streaming and short-window conversation memory; introduce a `bge-reranker-v2-m3`
cross-encoder; move to token-aware chunking; back progress with Redis; run both document
ingestion and scraping through a job queue (BullMQ/arq) for true multi-instance parallelism and
retries; build a golden-question evaluation harness for both document RAG and notice search; and
— highest priority for closing the gap between "delivered" and "complete" — implement
subscription/alert delivery: a `Subscription` model (user × category/keyword), a matcher run at
the end of each successful `ScrapeRun` against newly inserted `ScrapedItem` rows (the urgency and
category fields already computed at scrape time make this a filtering problem, not a new AI
problem), and outbound delivery through the WhatsApp channel that already exists. For
sustainability, secure an institutional steward for crawler/schema maintenance and model refresh,
and obtain legal guidance on automated retrieval/republication of government data under Nepalese
law.

### 6.4 Final Words
The system demonstrates that an open-source, cloud-hosted stack can close a real civic-access gap
in Nepal — aggregating, understanding, and answering questions about official notices in one
place, end to end, from a raw government HTML page to a cited, bilingual, AI-generated answer.
Both the document-RAG and notice-aggregation pipelines are delivered and working; subscription
alert delivery is the clear, well-scoped next step toward a service that could measurably widen
equitable access to public information.

---

## References

*(Harvard style; full list carried from the Investigation Report and to be extended for the
implementation phase.)* Key sources: Lewis et al. (2020) *Retrieval-Augmented Generation*;
Vaswani et al. (2017) *Attention Is All You Need*; Janssen, Charalabidis & Zuiderwijk (2012);
Wirtz, Weyerer & Geyer (2018); Minaee et al. (text classification); Varade et al. (2021)
summarisation; Han et al. (2024) GraphRAG; Khder (2021) web scraping; Chang & He (2025)
`robots.txt`; Kadaskar & Kamthe (2024) AWS; Shahi & Sitaula (2022) NLP for Nepali; Efthymiou
(2025) e-governance. Tooling: Qdrant, Crawl4AI, Hugging Face `sentence-transformers`
(`multilingual-e5-base`), Groq, Tesseract, NestJS, Prisma, Next.js.

---

## Appendices

- **Appendix A: Project Proposal Form (PPF)**
- **Appendix B: Ethics Form**
- **Appendix C: Supervisor Log Sheets**
- **Appendix D: Poster**
- **Appendix E: Gantt Chart** *(see §1.8)*
- **Appendix F: Sample Code** — chunker, embeddings (e5 prefixes), Qdrant store (hybrid search),
  intent router, Groq helper; see `docs/RAG_IMPLEMENTATION.md` for the full code-level walkthrough.
- **Appendix G: Respondent Demographic Profile**
- **Appendix H: Example Input/Output (RAG Queries and Responses)** — including hybrid-search log
  traces and cited answers.
```

