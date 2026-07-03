# RAG Implementation Guide

A complete, code-level walkthrough of how Retrieval-Augmented Generation (RAG) is
implemented in this project — from a file landing in the upload form to a cited,
markdown-formatted answer in the chat. It covers the architecture, every stage of
the pipeline, the optimizations applied, and how to operate and tune the system.

> Related docs: [QDRANT_SETUP.md](./QDRANT_SETUP.md) (vector DB setup),
> [DOCUMENT_SECTION_GUIDE.md](./DOCUMENT_SECTION_GUIDE.md) (UI usage).

---

## Table of Contents

1. [What is RAG (in this project)](#1-what-is-rag-in-this-project)
2. [Architecture](#2-architecture)
3. [Technology choices and why](#3-technology-choices-and-why)
4. [The data model and document lifecycle](#4-the-data-model-and-document-lifecycle)
5. [Ingestion pipeline (upload → vectors)](#5-ingestion-pipeline-upload--vectors)
   - 5.1 [Upload (NestJS)](#51-upload-nestjs)
   - 5.2 [Async processing hand-off](#52-async-processing-hand-off)
   - 5.3 [Text extraction (PDF / OCR / DOCX / images / TXT)](#53-text-extraction)
   - 5.4 [Chunking algorithm](#54-chunking-algorithm)
   - 5.5 [Embedding (batched)](#55-embedding-batched)
   - 5.6 [Indexing into Qdrant](#56-indexing-into-qdrant)
6. [Live progress tracking](#6-live-progress-tracking)
7. [Embed / Unembed lifecycle](#7-embed--unembed-lifecycle)
8. [Query pipeline (question → answer)](#8-query-pipeline-question--answer)
   - 8.1 [Intent routing (chat vs. document questions)](#81-intent-routing-chat-vs-document-questions)
   - 8.2 [Hybrid retrieval: RRF fusion, cosine re-scoring, threshold, dedupe](#82-hybrid-retrieval-rrf-fusion-cosine-re-scoring-threshold-dedupe)
   - 8.3 [Answer generation with Groq](#83-answer-generation-with-groq)
   - 8.4 [Extractive fallback (no API key)](#84-extractive-fallback-no-api-key)
9. [Frontend implementation](#9-frontend-implementation)
10. [Optimizations catalog](#10-optimizations-catalog)
11. [Configuration reference](#11-configuration-reference)
12. [API reference](#12-api-reference)
13. [Logging and observability](#13-logging-and-observability)
14. [Running and troubleshooting](#14-running-and-troubleshooting)
15. [Known limitations and future work](#15-known-limitations-and-future-work)

---

## 1. What is RAG (in this project)

RAG answers questions by **retrieving** relevant fragments of your own documents
and letting an LLM **generate** an answer grounded in those fragments — instead of
relying on whatever the model memorized during training.

Concretely, in Suchana AI:

1. An admin uploads a government notice (PDF, scanned image, DOCX, TXT).
2. The system extracts its text (OCR when needed), splits it into overlapping
   **chunks**, converts each chunk into a 768-dimensional **embedding vector**,
   and stores the vectors in **Qdrant**.
3. When a user asks a question, an **intent router** first decides whether it's
   a document question at all (greetings and small talk get a conversational
   reply without touching the vector store). Document questions are embedded
   with the *same* model and retrieved with **hybrid search** — dense (semantic)
   and BM25 sparse (keyword) results fused with Reciprocal Rank Fusion — and the
   winning chunks are passed as context to a Groq-hosted Llama model, which
   writes a cited, markdown answer using **only** that context.

The key property: the LLM never answers from its own memory — if the documents
don't contain the answer, it says so (with a generated, non-templated reply).

---

## 2. Architecture

Three services, each with a single responsibility:

```
┌─────────────────────┐        ┌──────────────────────┐        ┌─────────────────────────┐
│  apps/web           │        │  apps/api            │        │  apps/ai                │
│  Next.js 16 (React) │  HTTP  │  NestJS + Prisma     │  HTTP  │  Python raw ASGI        │
│                     │──────▶ │                      │──────▶ │  (uvicorn)              │
│  /rag page          │  :5005 │  documents.controller│  :8000 │  extract→chunk→embed    │
│  upload, toggle,    │        │  rag.controller      │        │  →index, query          │
│  progress, chat     │        │  auth (JWT guard)    │        │                         │
└─────────────────────┘        └──────────┬───────────┘        └───────┬─────────┬───────┘
                                          │                            │         │
                                          ▼                            ▼         ▼
                                   ┌────────────┐              ┌────────────┐ ┌────────────┐
                                   │ PostgreSQL │              │   Qdrant   │ │  Groq API  │
                                   │ (Document  │              │ (vectors + │ │ (llama-3.3 │
                                   │  metadata) │              │  payloads) │ │  -70b)     │
                                   └────────────┘              └────────────┘ └────────────┘
```

**Division of responsibility:**

| Layer | Owns | Does NOT own |
|---|---|---|
| `apps/web` | UX: upload, embed toggle, live progress, chat rendering | Any AI logic |
| `apps/api` (NestJS) | Auth, the **source-of-truth `Document` record** in Postgres, file storage on disk, proxying to the AI service | Vectors, embeddings, LLM calls |
| `apps/ai` (Python) | Extraction, OCR, chunking, embeddings, Qdrant, LLM prompting, in-memory progress | Auth, persistence of document metadata |

The browser **never talks to the AI service directly** — everything goes through
NestJS, which enforces JWT auth (`@UseGuards(JwtAuthGuard)`) and keeps the AI
service private.

---

## 3. Technology choices and why

| Concern | Choice | Why |
|---|---|---|
| Vector store | **Qdrant** (Docker, `qdrant-ai` container) | Simple REST/gRPC API, payload filtering (per-document search), cosine distance, deterministic point IDs, easy local dev |
| Embedding model | **`intfloat/multilingual-e5-base`** (768-dim) | Best free multilingual retriever at CPU-friendly size — handles **Nepali (Devanagari) and English** in the same vector space; requires `query:`/`passage:` prefixes (applied automatically); loaded lazily |
| Sparse model | **`Qdrant/bm25`** via `fastembed` | Keyword-exact matching (notice numbers, dates, names) that dense embeddings miss; fused with dense results via RRF; runs locally, no API |
| LLM | **Groq** hosting `llama-3.3-70b-versatile` | Extremely fast inference, generous free tier, OpenAI-compatible API (plain `httpx` call, no SDK needed) |
| OCR | **Tesseract** via `pytesseract` with `nep+eng` languages | Scanned government notices are common; Nepali language pack is essential |
| PDF text | **pypdf**, falling back to `pdf2image` + Tesseract | Fast path for born-digital PDFs; OCR only when the embedded text is too sparse |
| AI web framework | **Raw ASGI** (no FastAPI/Flask) | Zero framework dependencies; the service has 7 routes — a hand-rolled router keeps the footprint tiny |
| Doc metadata | **Postgres via Prisma** | Status lifecycle, ownership, timestamps — relational data that doesn't belong in a vector DB |

---

## 4. The data model and document lifecycle

### Prisma model (`apps/api/prisma/schema.prisma`)

```prisma
enum DocumentStatus {
  PENDING      // uploaded, waiting for the AI service
  PROCESSING   // extraction/embedding in progress
  INDEXED      // vectors live in Qdrant — searchable
  UNEMBEDDED   // file kept, vectors intentionally removed (toggle OFF)
  FAILED       // pipeline error (extraction, embedding, or Qdrant)
}

model Document {
  id          String         @id @default(uuid()) @db.Uuid
  title       String
  filename    String
  mimeType    String         @map("mime_type")
  fileSize    Int            @map("file_size")
  filePath    String         @map("file_path")   // on the API host's disk
  status      DocumentStatus @default(PENDING)
  isOcr       Boolean        @default(false)     // did extraction use OCR?
  textLength  Int?                                // chars extracted
  chunkCount  Int?                                // vectors in Qdrant
  uploadedBy  String         @db.Uuid
  indexedAt   DateTime?
  ...
}
```

### Lifecycle state machine

```
                 upload
                   │
                   ▼
               ┌────────┐   AI accepts    ┌────────────┐  201 from AI   ┌─────────┐
               │PENDING │ ───────────────▶│ PROCESSING │ ──────────────▶│ INDEXED │
               └────────┘                 └─────┬──────┘                └────┬────┘
                                                │  error                    │
                                                ▼                           │ POST /unembed
                                          ┌────────┐                        ▼
                          toggle ON       │ FAILED │                 ┌────────────┐
                       ┌──────────────────┴────────┘                 │ UNEMBEDDED │
                       │       (retry = same embed path)             └─────┬──────┘
                       │                                                   │
                       └────────────────◀──── POST /:id/embed ─────────────┘
```

Two important invariants:

- **The uploaded file always stays on disk** (`apps/api/uploads/<uuid>.<ext>`)
  until the document row is deleted. This is what makes *unembed → re-embed*
  possible without re-uploading.
- **Postgres is the source of truth for status**; Qdrant only stores vectors.
  The AI service's progress registry is ephemeral (in-memory) and advisory.

---

## 5. Ingestion pipeline (upload → vectors)

End-to-end sequence:

```
Browser                NestJS                       Python AI                    Qdrant
  │  POST /documents     │                              │                          │
  │  (multipart file) ──▶│ multer saves file to disk    │                          │
  │                      │ prisma.document.create()     │                          │
  │ ◀── 201 {PENDING} ───│ (responds IMMEDIATELY)       │                          │
  │                      │                              │                          │
  │                      │  processDocument() async:    │                          │
  │                      │  status = PROCESSING         │                          │
  │                      │  POST /documents ───────────▶│ save file copy           │
  │                      │  (streams file +             │ extract (pypdf/OCR)      │
  │                      │   document_id + title)       │ chunk (800/120 overlap)   │
  │  GET /documents/     │                              │ embed (batch 32) ──┐     │
  │  progress/batch ────▶│──── GET /progress?ids= ─────▶│ progress registry ◀┘     │
  │ ◀─ {stage, percent} ─│                              │ upsert batches ─────────▶│
  │                      │                              │                          │
  │                      │ ◀── 201 {chunk_count, ...} ──│                          │
  │                      │  status = INDEXED            │                          │
  │  (poll sees "done",  │  chunkCount, indexedAt saved │                          │
  │   refreshes list)    │                              │                          │
```

### 5.1 Upload (NestJS)

`apps/api/src/controllers/documents.controller.ts` uses `multer` disk storage
with strict validation — allowed MIME types and a 50 MB cap:

```ts
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const storage = diskStorage({
  destination: path.resolve(__dirname, '..', '..', 'uploads'),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
```

### 5.2 Async processing hand-off

The single most important design decision in ingestion: **the upload request
returns immediately.** A 40 MB scanned PDF can take minutes to OCR and embed —
holding the browser's HTTP request open that long is fragile (timeouts, refresh,
mobile networks).

```ts
// documents.service.ts
async create(data: {...}): Promise<Document> {
  const document = await this.prisma.document.create({ data });

  // Process asynchronously - don't block the upload response
  this.processDocument(document).catch((err) => {
    this.logger.error(`Failed to process document ${document.id}: ${err.message}`);
  });

  return document; // status: PENDING — client polls from here
}
```

`processDocument()` then streams the file to the AI service with the *database
id* as `document_id`, so Postgres and Qdrant share one identifier:

```ts
const form = new FormData();
form.append('file', fs.createReadStream(fullPath), { filename, contentType });
form.append('document_id', document.id);   // Postgres UUID == Qdrant doc_id
form.append('title', document.title);      // stored in every chunk's payload

await firstValueFrom(
  this.httpService.post(`${this.aiServiceUrl}/documents`, form, {
    headers: { ...form.getHeaders() },
    timeout: this.aiIndexTimeoutMs,     // AI_INDEX_TIMEOUT_MS, default 10 min
    maxBodyLength: Infinity,            // don't cap large uploads
    maxContentLength: Infinity,
  }),
);
```

On success it persists what the AI reported; on any failure it marks `FAILED`
(which the UI turns into a "toggle to retry" affordance):

```ts
await this.prisma.document.update({
  where: { id: document.id },
  data: {
    status: DocumentStatus.INDEXED,
    chunkCount: result.chunk_count ?? null,
    textLength: result.text_length ?? null,
    isOcr: result.is_ocr ?? false,
    indexedAt: new Date(),
  },
});
```

### 5.3 Text extraction

`apps/ai/app/extractor.py` dispatches on MIME type. The interesting part is the
**PDF heuristic**: born-digital PDFs are read with `pypdf` (fast), but if a PDF
yields suspiciously little text — under **100 characters per page** — it is
almost certainly a scan, so the extractor re-renders pages to images and runs
Tesseract OCR with Nepali+English:

```python
def _extract_pdf(path: Path) -> dict:
    reader = PdfReader(str(path))
    page_count = len(reader.pages)
    texts = [page.extract_text() or "" for page in reader.pages]
    full_text = "\n\n".join(texts)

    if page_count > 0 and len(full_text.strip()) < 100 * page_count:
        logger.info("PDF %s has little embedded text; falling back to OCR", path.name)
        return _ocr_pdf(path, page_count)

    return {"text": full_text, "is_ocr": False, "page_count": page_count}


def _ocr_pdf(path: Path, page_count: int) -> dict:
    images = convert_from_path(str(path))            # pdf2image → PIL images
    texts = [pytesseract.image_to_string(img, lang=config.TESSERACT_LANG)
             for img in images]                      # TESSERACT_LANG = "nep+eng"
    return {"text": "\n\n".join(texts), "is_ocr": True, "page_count": page_count}
```

The `is_ocr` flag flows all the way back to the UI (the purple "OCR" badge on a
document card), which matters because OCR text is noisier and users should know.

All heavy imports (`pypdf`, `pytesseract`, `docx`, `PIL`) are done **inside the
functions**, so the service boots instantly and only pays for what a given file
type needs.

### 5.4 Chunking algorithm

`apps/ai/app/chunker.py`. Embedding models have small effective context, and
retrieval granularity matters: too-large chunks dilute similarity scores;
too-small chunks lose context. Defaults: `CHUNK_SIZE=800` chars,
`CHUNK_OVERLAP=120` chars (≈200 tokens per chunk — comfortable inside
e5-base's 512-token window).

The algorithm is **structure-aware, hierarchical**:

```
text
 └─ split on blank lines            → paragraphs        (semantic units)
     └─ paragraph > 800 chars?
         └─ split on sentence ends  → sentences         (regex: [.!?।] — includes
             └─ sentence > 800?                            the Devanagari danda ।)
                 └─ split on words  → word runs         (last resort)
```

Segments are then **greedily packed** into chunks up to `CHUNK_SIZE`, and each
new chunk begins with the **tail of the previous chunk** (the overlap), so facts
that straddle a boundary are fully present in at least one chunk:

```python
for segment in segments:
    if not current:
        current = segment
    elif len(current) + len(segment) + 1 <= chunk_size:
        current = current + "\n" + segment
    else:
        chunks.append(_make_chunk(current, len(chunks), char_offset))
        char_offset += len(current) - overlap
        if overlap > 0 and len(current) > overlap:
            # Snap the overlap to a word boundary so no chunk starts
            # mid-word (which pollutes both retrieval and displayed text).
            tail = current[-overlap:]
            boundary = tail.find(" ")
            if boundary != -1:
                tail = tail[boundary + 1:]
            current = (tail + "\n" + segment) if tail else segment
        else:
            current = segment
```

> **Bug fixed along the way:** the original overlap took a raw character slice
> (`current[-overlap:]`), which could start a chunk mid-word — retrieved chunks
> (and extractive answers) began with fragments like `"ural Information
> Processing Systems…"`. Snapping to the next space fixed both retrieval quality
> and display.

Every chunk is logged individually (index, char range, size, preview), plus a
summary — this is the "chunking logger":

```
[INFO] pnm-ai.chunker: chunk #0: chars 0-367 (367 chars) | Notice One: Scholarship...
[INFO] pnm-ai.chunker: Chunked 91739 chars into 153 chunks (chunk_size=800,
                       overlap=120, min=143, avg=709, max=919 chars/chunk)
```

The summary's min/avg/max distribution is the fastest way to spot chunking
pathologies (e.g. a wall of tiny chunks from an OCR'd table).

Each chunk carries positional metadata used later in the Qdrant payload:

```python
{"content": ..., "index": i, "char_start": ..., "char_end": ...}
```

### 5.5 Embedding (batched)

`apps/ai/app/embeddings.py`. The model is loaded **lazily on first use** (a
global singleton), so service startup and `/health` stay instant.

**E5 instruction prefixes.** E5-family models are trained asymmetrically:
questions must be embedded as `query: <text>` and indexed content as
`passage: <text>`. Skipping the prefixes measurably degrades retrieval, so
`get_embeddings(texts, kind=...)` applies them automatically whenever the
configured model name contains `"e5"` (other models pass through untouched):

```python
def _apply_prefix(texts, kind):
    if "e5" in config.EMBEDDING_MODEL.lower():
        prefix = "query: " if kind == "query" else "passage: "
        return [prefix + t for t in texts]
    return texts
```

Chunks are embedded with `kind="passage"` at ingest; questions with
`kind="query"` at search. Embedding is done in **batches**
(`EMBEDDING_BATCH_SIZE=32`) rather than one giant `encode()` call:

```python
def get_embeddings(texts, kind="passage", on_progress=None):
    model = _load_model()
    total = len(texts)
    batch_size = config.EMBEDDING_BATCH_SIZE
    results = []

    for start in range(0, total, batch_size):
        batch = texts[start:start + batch_size]
        t0 = time.perf_counter()
        vectors = model.encode(batch, batch_size=batch_size, normalize_embeddings=True)
        results.extend(vectors.tolist())
        done = min(start + batch_size, total)
        logger.info("Embedded batch %d-%d/%d (%.0fms)", start, done, total,
                    (time.perf_counter() - t0) * 1000)
        if on_progress:
            on_progress(done, total)      # feeds the live progress bar

    return results
```

Why batching matters for **large documents**:

- **Bounded memory** — a 1,000-page OCR'd PDF can produce thousands of chunks;
  encoding them all at once spikes RAM. Batches keep the working set constant.
- **Progress** — the `on_progress(done, total)` callback fires per batch and
  drives the UI's live percentage.
- **`normalize_embeddings=True`** — vectors are L2-normalized at encode time,
  which makes cosine similarity equal to a plain dot product (used by the
  extractive fallback) and matches Qdrant's cosine distance setting.

**Event-loop protection:** `model.encode()` is CPU-bound and synchronous. The
ASGI handler runs the entire ingest in a worker thread so the single-process
server can still answer `/health`, `/query`, and progress polls mid-embed:

```python
# main.py — inside the upload handler
return await asyncio.to_thread(
    _ingest_document, doc_id, save_path, filename, mime_type, metadata
)
```

Without this, embedding a large document would freeze every other request —
including the progress endpoint that's supposed to report on it.

### 5.6 Indexing into Qdrant

`apps/ai/app/store.py`. The collection uses **named vectors** — a dense vector
for semantic similarity plus a BM25 **sparse vector** for keyword matching
(hybrid search, §8.2) — and a keyword **payload index** on `doc_id` so
per-document filtering stays fast as the corpus grows:

```python
client.create_collection(
    collection_name=config.QDRANT_COLLECTION,          # "documents"
    vectors_config={
        "dense": VectorParams(size=config.EMBEDDING_DIM,      # 768
                              distance=Distance.COSINE),
    },
    sparse_vectors_config={
        "bm25": SparseVectorParams(index=SparseIndexParams(),
                                   modifier=Modifier.IDF),    # server-side IDF
    },
)
client.create_payload_index(collection_name=..., field_name="doc_id",
                            field_schema=PayloadSchemaType.KEYWORD)
```

**Schema self-healing:** `ensure_collection()` validates the existing collection
against the current config on startup (dense dimension matches
`EMBEDDING_DIM`, sparse vector present when `HYBRID_SEARCH=true`). On mismatch
— e.g. after switching embedding models — it logs a warning and **recreates the
collection automatically**, since vectors from a different model are unusable
anyway. Documents must then be re-embedded (the files are still on disk, so
it's one toggle per document in the UI).

Every chunk becomes one **point** carrying both vectors:

```python
point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{doc_id}:{i}"))
vector = {"dense": dense_embedding,
          "bm25": SparseVector(indices=..., values=...)}     # fastembed BM25
payload = {
    "doc_id": doc_id,          # enables per-document filtering + deletion
    "chunk_index": i,
    "content": chunk["content"],          # the actual text (returned at query time)
    "char_start": ..., "char_end": ...,
    "original_filename": ..., "mime_type": ...,
    "title": ...,              # shown as the source label in the chat UI
}
```

1. **Deterministic IDs** — `uuid5(doc_id + chunk_index)` means re-embedding the
   same document **upserts over** its old points instead of duplicating them.
   Re-embed is idempotent by construction; no "delete then insert" dance.
2. **`doc_id` in the payload** — powers three features: scoped search ("Ask AI"
   about one document), `count()` for status checks, and `delete()` by filter
   for unembed.
3. **Sparse vectors are optional** — if `fastembed` fails to load (or
   `HYBRID_SEARCH=false`), indexing and search degrade gracefully to
   dense-only.

Upserts are batched (100 points per call) with per-batch logging and progress:

```python
for start in range(0, total, batch_size):
    client.upsert(collection_name=..., points=points[start:start + batch_size])
    logger.info("Upserted points %d-%d/%d for doc_id=%s", start, done, total, doc_id)
    if on_progress:
        on_progress(done, total)
```

---

## 6. Live progress tracking

Problem: ingestion is asynchronous and can take minutes. The UI needs to show
*"Embedding chunk 96/384 — 62%"*, not a spinner.

Solution: a small **in-memory progress registry** in the AI service
(`apps/ai/app/progress.py`), keyed by `doc_id`, updated by the pipeline via the
`on_progress` callbacks, read via HTTP.

### Stage-weighted percentage

Each stage owns a slice of the overall bar, so the percentage is monotonic and
meaningful even though stages have very different durations:

```python
_STAGE_BASE = {
    "extracting": (0, 15),
    "chunking":   (15, 25),
    "embedding":  (25, 85),   # the long pole gets the widest band
    "indexing":   (85, 100),
}

def update(doc_id, stage, message="", done=0, total=0):
    ...
    lo, hi = _STAGE_BASE.get(stage, (0, 0))
    fraction = (done / total) if total else 0.0
    entry["percent"] = round(lo + (hi - lo) * min(fraction, 1.0))
```

Design properties:

- **Thread-safe** (`threading.Lock`) — the pipeline writes from a worker thread
  while the event loop reads.
- **Self-cleaning** — terminal entries (done/failed) expire after 15 minutes; a
  hard cap of 200 entries evicts the oldest. No unbounded growth.
- **Deliberately ephemeral** — if the AI service restarts, progress is lost but
  nothing breaks: Postgres still has the real status, and the UI has a periodic
  list-refresh safety net (see §9).

### The batched progress endpoint

The first implementation polled `GET /documents/:id/progress` **per document
every 2 seconds** — and each of those calls did a Postgres `findOne` *plus* an
HTTP hop to the AI service. With several processing documents the Network tab
flooded. The fix collapses everything into **one browser request per tick**:

```
Browser ── GET /documents/progress/batch?ids=a,b,c ──▶ NestJS
NestJS  ── GET /progress?ids=a,b,c ──────────────────▶ AI service
AI      ── answers from the in-memory dict (no DB, no Qdrant) ──▶
```

NestJS (note the route ordering — it must be declared *before* `@Get(':id')`
or "progress" gets parsed as a UUID):

```ts
// Must be declared before ':id' routes so 'progress' isn't parsed as a UUID.
@Get('progress/batch')
async progressBatch(@Query('ids') ids?: string) {
  const docIds = (ids ?? '').split(',').filter(Boolean).slice(0, 50);
  return this.documentsService.getProgressBatch(docIds);
}
```

AI service (raw ASGI — parses the query string by hand):

```python
if method == "GET" and path == "/progress":
    return _progress_batch(scope)   # → {"progress": {id: entry|None, ...}}
```

Cost per poll tick went from `N × (auth + DB read + proxy hop)` to
`1 × (auth + in-memory dict lookup)`.

---

## 7. Embed / Unembed lifecycle

Documents auto-embed on upload, but embedding is a **reversible toggle**:

| Action | Endpoint | What happens |
|---|---|---|
| Toggle OFF | `POST /documents/:id/unembed` | AI `DELETE /documents/:id` removes all points matching `doc_id` from Qdrant → status `UNEMBEDDED`, `chunkCount`/`indexedAt` nulled. **File stays on disk.** |
| Toggle ON | `POST /documents/:id/embed` | Re-runs `processDocument()` on the stored file → `PROCESSING` → `INDEXED`. Deterministic point IDs make this an upsert. |
| Retry after failure | same `embed` endpoint | `FAILED` docs use the identical path. |

Guard rails in `documents.service.ts` prevent nonsensical transitions:

```ts
async embed(id: string): Promise<Document> {
  const document = await this.findOne(id);
  if (document.status === DocumentStatus.PROCESSING)
    throw new ConflictException('Document is already being processed');
  if (document.status === DocumentStatus.INDEXED)
    throw new ConflictException('Document is already embedded');

  this.processDocument(document).catch(...);   // async, client polls
  return this.prisma.document.update({
    where: { id }, data: { status: DocumentStatus.PROCESSING },
  });
}
```

Unembed is **strict about the vector store**: if the AI service is unreachable,
it throws instead of marking `UNEMBEDDED` — otherwise stale vectors would keep
appearing in answers for a document the UI claims is off. (Full deletion is
looser: it proceeds even if the AI cleanup fails, because the DB row and file
are going away regardless.)

In Qdrant, deletion by filter:

```python
client.delete(
    collection_name=config.QDRANT_COLLECTION,
    points_selector=Filter(must=[FieldCondition(key="doc_id",
                                                match=MatchValue(value=doc_id))]),
)
```

---

## 8. Query pipeline (question → answer)

`POST /rag/query` (NestJS, JWT-guarded) → `POST /query` (AI). The full flow in
`apps/ai/app/rag.py`:

```
message ──▶ intent routing (lexical → semantic → LLM tiebreak)
          │
          ├─ chat intent ──▶ conversational reply (no retrieval, no sources)
          │
          └─ document question:
             ──▶ embed question ("query:" prefix, same E5 model)
             ──▶ HYBRID Qdrant search: dense + BM25 prefetch → RRF fusion
                 (top_k × 3 candidates, max 20; optional doc_id filter)
             ──▶ re-score fused hits with true cosine (dense vector ⋅ query)
             ──▶ threshold: drop score < RAG_SCORE_THRESHOLD (0.78)
             ──▶ dedupe: drop near-identical chunks (overlap artifacts)
             ──▶ keep top_k (default 5) → context
             ──▶ Groq llama-3.3-70b (temp 0.7 + style rotation) or extractive fallback
             ──▶ {answer, sources[{doc_id, chunk_index, content, score, title}], model_used}
```

### 8.1 Intent routing (chat vs. document questions)

Not every message is a document question — users type "Hi", "Helllloooooo",
"gud mrng ji", "k cha". Running vector search on greetings produces either
nonsense sources or a cold "no documents found". A **three-tier router** in
`rag.py` decides the path, cheapest check first:

1. **Lexical squeeze-match** (free, instant) — the message is lowercased,
   stripped of punctuation/emoji, and letter runs are collapsed
   (`"Helllloooooo"` → `"helo"`), then compared against a squeezed phrase list
   covering English, Nepali (Devanagari), and romanized Nepali greetings,
   thanks, and farewells. This catches stretched/typo variants of known
   phrases without any model call.

2. **Semantic prototype router** (free — reuses the query embedding that
   retrieval needs anyway) — for short messages (≤60 chars) that pass tier 1,
   the question vector is compared against pre-embedded **prototype examples**
   of chit-chat (`"yo wassup my friend"`, `"timro naam k ho"`) vs. document
   questions (`"when is the application deadline"`, `"notice ma k lekheko
   cha"`). If the similarity gap exceeds a margin (`0.04`), that verdict wins.

3. **LLM tiebreak** (one tiny Groq call, temperature 0, one-word answer) —
   only for messages inside the ambiguous band, where embedding models
   genuinely can't separate heavy textspeak (`"helo ji kasto xa"` vs
   `"tax ko barema k cha"`). Without a Groq key this tier is skipped and
   ambiguous messages default to retrieval — the score threshold rejects noise
   downstream anyway.

Chat-intent messages get a reply from `llm.generate_chat()` — a persona prompt
plus a **randomly rotated style hint** ("keep it under 15 words", "lead with an
offer to help") at temperature 0.9, so repeated greetings never converge on one
template sentence. With no API key, a small randomized canned set is the floor.

### 8.2 Hybrid retrieval: RRF fusion, cosine re-scoring, threshold, dedupe

Dense embeddings are great at meaning but miss **exact identifiers** — notice
numbers, dates, names. BM25 is the opposite. Hybrid search runs both and fuses
the rankings with **Reciprocal Rank Fusion** inside Qdrant:

```python
results = client.query_points(
    collection_name=...,
    prefetch=[
        Prefetch(query=query_embedding, using="dense", filter=..., limit=top_k * 2),
        Prefetch(query=SparseVector(indices=..., values=...), using="bm25",
                 filter=..., limit=top_k * 2),
    ],
    query=FusionQuery(fusion=Fusion.RRF),
    limit=top_k,
    with_vectors=["dense"],           # needed for cosine re-scoring below
)
```

**Cosine re-scoring.** RRF scores are rank-based (sums of `1/(60+rank)`), which
breaks two things that expect cosine similarity: the `RAG_SCORE_THRESHOLD`
filter and the relevance percentages shown in the UI. So after fusion each hit
is re-scored as `dense_vector ⋅ query_vector` (both L2-normalized ⇒ dot ==
cosine) and results re-sorted. Downstream code never knows fusion happened.

If the sparse model is unavailable, `store.search()` silently degrades to a
plain dense query — same output shape.

Candidates then pass through over-fetch → threshold → dedupe:

```python
_CANDIDATE_MULTIPLIER = 3
_MAX_CANDIDATES = 20

candidates = store.search(
    query_embedding=query_embedding,
    query_text=question,               # for the BM25 sparse leg
    top_k=min(top_k * _CANDIDATE_MULTIPLIER, _MAX_CANDIDATES),
    filter_doc_id=doc_id,          # set when the user clicked "Ask AI" on a card
)

def _select_context(results, top_k):
    selected, seen_keys = [], set()
    for r in results:
        if r["score"] < config.RAG_SCORE_THRESHOLD:   # 1. junk filter
            continue
        # 2. near-duplicate filter: overlapping chunks share boundary text,
        #    so a normalized 120-char prefix is a cheap duplicate signal
        key = " ".join(r["content"].split())[:120].lower()
        if key in seen_keys:
            continue
        seen_keys.add(key)
        selected.append(r)
        if len(selected) >= top_k:                    # 3. cap at top_k
            break
    return selected
```

- **Over-fetch** gives the filters room to work — after dropping weak and
  duplicate hits there are still `top_k` good chunks left.
- **Score threshold** (`0.78` cosine) stops barely-related chunks from reaching
  the LLM. Irrelevant context actively degrades LLM answers ("lost in the
  middle" + hallucinated connections), and when *nothing* passes the threshold
  the system honestly says so — via `llm.generate_no_results()`, which writes a
  unique reply responding to the actual question in the user's language,
  instead of a canned string. **Why 0.78 and not something like 0.25:** E5
  models compress cosine similarity into roughly `0.7–0.9`; measured on real
  data, irrelevant hits score ~`0.76–0.78` and relevant ones `0.82+`, so a
  conventional-looking low threshold would filter nothing at all.
- **Dedupe** matters because chunk overlap (§5.4) intentionally duplicates
  boundary text — without it, two of five context slots could be the same
  sentences.

Per-document filtering uses a Qdrant payload filter (applied inside **both**
prefetch legs), not a separate collection:

```python
query_filter = Filter(must=[FieldCondition(key="doc_id",
                                           match=MatchValue(value=doc_id))])
```

### 8.3 Answer generation with Groq

`apps/ai/app/llm.py`. The system prompt encodes the desired **response pattern**
— grounding, inline numbered citations, markdown structure, length matched to
the question, and language mirroring:

```python
SYSTEM_PROMPT = """You are Suchana AI, an assistant that answers questions about
Nepalese public notices and government documents using ONLY the provided context.

Rules:
- Ground every claim in the context. Never invent facts, numbers, dates, or names.
- Cite sources inline with bracketed numbers matching the context blocks, e.g. [1]
  or [2][3]. Cite after the specific claim, not in a list at the end.
- Format the answer in Markdown. Use short paragraphs; use bullet points for
  enumerations (requirements, steps, allocations) and **bold** for key figures,
  dates, and names.
- Match the answer length to the question: a factual lookup gets 1-2 sentences;
  "explain"/"summarize" questions get a structured answer, still under ~200 words.
- Answer in the same language the question is asked in, unless instructed otherwise.
- If the context does not contain the answer, say so plainly in one sentence and,
  if partially relevant material exists, state what IS covered. Do not pad.
- Answer directly — never open with filler like "According to the context" or
  "Based on the provided documents", and do not restate the question.
- Vary your wording naturally between answers; never sound like a template."""
```

**Answer variety (same question ≠ same answer).** Two mechanisms make repeated
questions produce genuinely different — but equally grounded — answers:

1. `temperature: 0.7` (grounding is enforced by the prompt rules, so only the
   phrasing varies, not the facts), and
2. a **randomly rotated structural directive** appended to the system prompt per
   request: *"lead with the single most important fact"*, *"structure as brief
   bullet points"*, *"answer in flowing prose this time"*, *"frame as if
   briefing a colleague"*… So the same "What OCR technology is used?" might come
   back as a bold-led sentence, a bulleted summary, or contextual prose — all
   citing the same sources.

Context blocks are numbered and **labeled with the document title**, so the
model's `[1]`-style citations line up with the source chips the UI renders:

```python
context = "\n\n".join(
    f"[{i + 1}] (from “{chunk.get('title') or 'Untitled document'}”)\n{chunk['content']}"
    for i, chunk in enumerate(context_chunks)
)
```

All Groq calls go through one hardened helper, `_groq_chat(messages,
max_tokens, temperature)` — a plain OpenAI-compatible `httpx` POST, no SDK —
shared by answers, chat replies, no-results replies, and the intent tiebreak:

- **One retry on transient failures** — network errors and `429/500/502/503`
  responses get a single retry after a short backoff before giving up.
- **Guarded response parsing** — a malformed response body (missing
  `choices`) is caught and logged instead of raising `KeyError` mid-request.
- **Output sanitization** — `_clean_answer()` strips leaked
  `<think>…</think>` blocks (reasoning models emit them) so they never reach
  the UI.

**Every failure path degrades gracefully to the fallback** — missing API key,
exhausted retries, non-200 from Groq — the user always gets *an* answer:

```python
answer = await _groq_chat(messages, max_tokens=1024, temperature=0.7)
if answer is None:
    return _extractive_fallback(question, context_chunks)
```

### 8.4 Extractive fallback (no API key)

When the LLM is unavailable, the service still answers by **extraction**: split
the retrieved chunks into sentences, embed each sentence with the same E5
model, rank by cosine similarity to the question, and return the best few as a
bulleted list in original reading order:

```python
q_vec = np.array(embeddings.get_embedding(question))
sent_vecs = np.array(embeddings.get_embeddings(sentences))
scores = sent_vecs @ q_vec            # normalized vectors ⇒ dot == cosine

# top sentences, skipping near-duplicates from chunk overlap
picked = []
for i in np.argsort(scores)[::-1]:
    if sentences[i][:60].lower() in seen: continue
    picked.append(int(i))
    if len(picked) >= FALLBACK_SENTENCES: break

best = [sentences[i] for i in sorted(picked)]     # reading order
return "The most relevant points from the documents:\n\n" + \
       "\n".join(f"- {s}" for s in best)
```

Sentence hygiene (learned from real output): bullets/dashes are stripped before
splitting, fragments shorter than 25 chars are dropped, and sentences starting
with a lowercase Latin letter (mid-sentence fragments from chunk boundaries) are
skipped. The splitter handles the Devanagari danda (`।`) alongside `.!?`.

The response's `model_used` field is `"extractive"` in this mode, and the chat
UI renders an amber notice telling the developer to set `GROQ_API_KEY` — the
degraded mode is never silent.

---

## 9. Frontend implementation

Everything lives in `apps/web/app/rag/page.tsx` with API helpers in
`apps/web/lib/api.ts` and types in `apps/web/lib/types.ts`.

### Layout and responsiveness

- The page is a fixed-height app shell (`h-dvh`, not `h-screen` — `dvh` tracks
  mobile browser chrome correctly) with internally scrolling panels.
- **Desktop (`lg+`)**: a three-mode view switcher — Library / Split / Chat —
  where Split is a `380px + 1fr` grid.
- **Mobile**: one panel at a time with a bottom **Library / Chat tab bar**;
  paddings, avatars, and bubbles all step down at `sm`.

```tsx
{/* Desktop */}
<div className="hidden h-full lg:block">
  {view === "split" && (
    <div className="grid h-full grid-cols-1 gap-5 lg:grid-cols-[380px_1fr]">
      {Library}{Chat}
    </div>
  )}
  ...
</div>

{/* Mobile: one panel + bottom tabs */}
<div className="flex h-full flex-col gap-3 lg:hidden">
  <div className="min-h-0 flex-1">{mobileTab === "library" ? Library : Chat}</div>
  <div className="grid shrink-0 grid-cols-2 gap-1 rounded-2xl bg-vez-surface p-1.5">
    ...Library / Chat buttons...
  </div>
</div>
```

### The embed toggle and progress bar

Each `DocCard` renders one of two state rows:

- **Processing** → progress bar driven by the polled `DocumentProgress`: stage
  label ("Embedding"), `processed/total chunks`, percent, animated width.
- **Otherwise** → an accessible switch (`role="switch"`, `aria-checked`):
  ON = `INDEXED`, OFF = `UNEMBEDDED`/`FAILED` ("Toggle to retry").

```tsx
const updated = doc.status === "INDEXED"
  ? await unembedDocument(doc.id)     // ON  → OFF: remove vectors
  : await embedDocument(doc.id)       // OFF → ON: re-embed stored file
setDocs(prev => prev.map(d => (d.id === doc.id ? { ...d, ...updated } : d)))
```

The optimistic local update flips the card into `PROCESSING` instantly, which
in turn activates the progress poller.

### Polling strategy

One effect keyed on the **comma-joined list of processing doc IDs** (a stable
string — so the effect doesn't churn on unrelated `docs` changes):

```tsx
const processingKey = docs
  .filter(d => d.status === "PENDING" || d.status === "PROCESSING")
  .map(d => d.id).join(",")

useEffect(() => {
  if (!processingKey) return                    // idle ⇒ zero requests
  const ids = processingKey.split(",")
  let ticks = 0
  const tick = async () => {
    ticks += 1
    const result = await fetchDocumentsProgress(ids)   // ONE batched request
    ...merge into progressMap...
    // Refresh the list when something finished — or every 8th tick as a
    // safety net in case the AI service restarted and lost its registry.
    if (anyFinished || ticks % 8 === 0) loadDocs({ silent: true })
  }
  tick()
  const timer = setInterval(tick, 2500)
  return () => { cancelled = true; clearInterval(timer) }
}, [processingKey, loadDocs])
```

Properties worth copying:

- **Zero requests at rest** — polling exists only while something is embedding.
- **One request per tick** regardless of how many documents are processing.
- **Silent refresh** — `loadDocs({ silent: true })` skips the loading spinner so
  the list doesn't flash during background updates.
- **Safety net** — even if the AI's in-memory progress is gone (restart), the
  every-8th-tick list refresh picks up the terminal status from Postgres.

### Markdown answers and sources

Assistant messages render through `react-markdown` + `remark-gfm` with
project-styled components (lists, bold, tables, code, blockquotes), so the
LLM's structured output displays properly. User messages stay plain text.

Source chips are **grouped per document** — several retrieved chunks from the
same file render as one chip with the citation numbers combined (`[1][2][3]
Hamro Life Bank SRS · 87%`, showing the best score), instead of the same raw
filename repeated per chunk. Titles are humanized for display
(`_Hamro_Life_Bank_SRS.pdf` → `Hamro Life Bank SRS`), and hovering shows a
content preview via `title`:

```tsx
// groupSources(): Map keyed by doc_id → {title, refs[], maxScore, preview}
{groupSources(msg.sources).map((g, i) => (
  <span key={i} title={g.preview} className="...">
    <BookOpen className="size-3 shrink-0" />
    <span className="font-mono">{g.refs.map(n => `[${n}]`).join("")}</span>
    <span className="truncate">{g.title}</span>
    <span>{Math.round(g.score * 100)}%</span>
  </span>
))}
```

If `model_used === "extractive"`, an amber banner under the message explains
fallback mode and names the missing env var.

---

## 10. Optimizations catalog

Every optimization in the system, with the problem it solves:

| # | Optimization | Problem it solves | Where |
|---|---|---|---|
| 1 | **Async ingestion** — upload returns `PENDING` immediately, processing continues server-side | Browser requests timing out on large/OCR documents | `documents.service.ts create()` |
| 2 | **Worker-thread pipeline** (`asyncio.to_thread`) | CPU-bound embedding froze the single-process ASGI event loop — even `/health` hung mid-embed | `main.py` |
| 3 | **Batched embedding** (`EMBEDDING_BATCH_SIZE=32`) | Unbounded memory on 1000+-chunk documents; no progress signal | `embeddings.py` |
| 4 | **Batched Qdrant upserts** (100 points/call) | Single huge upsert payloads; no progress signal | `store.py` |
| 5 | **Lazy model loading** (singleton on first use) | Slow service startup; `/health` shouldn't require a 400 MB model load | `embeddings.py` |
| 6 | **Lazy extraction imports** | Don't pay for pypdf/Tesseract/docx imports unless that file type shows up | `extractor.py` |
| 7 | **Deterministic point IDs** (`uuid5(doc_id:index)`) | Re-embedding duplicated vectors; delete-then-insert races | `store.py` |
| 8 | **Batched progress endpoint** (1 request/tick) | N documents × poll every 2s × (DB read + proxy hop) flooded the network tab | `documents.controller.ts`, `main.py` |
| 9 | **Conditional polling** (only while processing; stable effect key) | Constant background polling at rest; effect churn re-creating timers | `rag/page.tsx` |
| 10 | **Silent list refresh** + every-8th-tick safety net | Loading-spinner flash on every poll; stuck `PROCESSING` UI after AI restart | `rag/page.tsx` |
| 11 | **Over-fetch → threshold → dedupe retrieval** | Weak/duplicate chunks wasting LLM context slots; hallucinations from irrelevant context | `rag.py` |
| 12 | **Word-boundary chunk overlap** | Chunks starting mid-word polluting retrieval and displayed sources | `chunker.py` |
| 13 | **In-memory progress registry with TTL + cap** | Progress state growing without bound; needing a DB table for ephemeral data | `progress.py` |
| 14 | **Graceful LLM degradation** (extractive fallback, visible in UI) | Hard failures when Groq is down/unconfigured; silent quality degradation | `llm.py`, `rag/page.tsx` |
| 15 | **Configurable long index timeout** (`AI_INDEX_TIMEOUT_MS`, 10 min) + `maxBodyLength: Infinity` | 2-minute axios default killed large-document indexing mid-flight | `documents.service.ts` |
| 16 | **PDF text-density OCR heuristic** (<100 chars/page → OCR) | OCR-ing born-digital PDFs (slow); reading empty text from scans | `extractor.py` |
| 17 | **Hybrid dense + BM25 retrieval with RRF fusion** | Dense embeddings missing exact identifiers (notice numbers, dates, names) | `store.py` |
| 18 | **Cosine re-scoring after fusion** | RRF rank scores breaking the threshold filter and UI relevance percentages | `store.py` |
| 19 | **E5 query/passage prefixes** (applied automatically) | Un-prefixed E5 embeddings silently degrading retrieval quality | `embeddings.py` |
| 20 | **Three-tier intent router** (lexical squeeze → prototype embeddings → LLM tiebreak) | Greetings/small talk hitting vector search; sloppy human typing misrouted | `rag.py`, `llm.py` |
| 21 | **Answer style rotation + temp 0.7** | Repeated questions returning verbatim-identical answers | `llm.py` |
| 22 | **Retry + guarded parse + `<think>` strip on all LLM calls** | Transient Groq failures surfacing as errors; reasoning-model artifacts in the UI | `llm.py` |
| 23 | **`doc_id` keyword payload index** | Per-document filtered search slowing down as the corpus grows | `store.py` |
| 24 | **Collection schema validation + auto-recreate** | Dimension-mismatch errors after switching embedding models | `store.py` |
| 25 | **Grouped source chips** (one per document, citations combined, humanized titles) | Chat showing `[1] _Hamro_Life_Bank_SRS` three times per answer | `rag/page.tsx` |

---

## 11. Configuration reference

### `apps/ai/.env`

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `8000` | uvicorn port |
| `LOG_LEVEL` | `INFO` | set `DEBUG` for search-hit logging |
| `EMBEDDING_MODEL` | `intfloat/multilingual-e5-base` | must be multilingual for Nepali support |
| `EMBEDDING_DIM` | `768` | **must match the model AND the Qdrant collection**; changing the model requires recreating the collection |
| `EMBEDDING_BATCH_SIZE` | `32` | chunks per `encode()` call; lower on small machines |
| `HYBRID_SEARCH` | `true` | BM25 sparse + dense with RRF fusion; `false` = dense-only |
| `SPARSE_MODEL` | `Qdrant/bm25` | fastembed sparse model for the keyword leg |
| `QDRANT_URL` | `http://localhost:6333` | |
| `QDRANT_API_KEY` | *(empty)* | required if the Qdrant container sets one |
| `QDRANT_COLLECTION` | `documents` | |
| `CHUNK_SIZE` | `800` | characters per chunk |
| `CHUNK_OVERLAP` | `120` | characters carried into the next chunk |
| `RAG_SCORE_THRESHOLD` | `0.78` | cosine floor for context inclusion; raise for precision, lower for recall. **Not a typical 0–1 value**: E5 compresses scores into ~0.7–0.9 |
| `GROQ_API_KEY` | *(empty)* | **without it, answers use the extractive fallback** |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | any Groq chat model id |
| `TESSERACT_LANG` | `nep+eng` | OCR language packs |
| `UPLOAD_DIR` | `./data/uploads` | AI-side file copies |
| `CORS_ORIGINS` | `http://localhost:3000,...` | |

### `apps/api/.env` (RAG-relevant)

| Variable | Default | Meaning |
|---|---|---|
| `AI_SERVICE_URL` | `http://localhost:8000` | |
| `AI_INDEX_TIMEOUT_MS` | `600000` | max wall time for one document's ingestion |
| `DATABASE_URL` | — | Postgres with the `Document` table |

### Tuning cheat-sheet

- **Answers miss facts that are in the docs** → lower `RAG_SCORE_THRESHOLD`, or
  raise `top_k` in the query, or reduce `CHUNK_SIZE` (finer retrieval).
- **Answers ramble across unrelated notices** → raise `RAG_SCORE_THRESHOLD`.
- **Facts cut off mid-sentence in sources** → raise `CHUNK_OVERLAP`.
- **Embedding too slow / OOM on a small box** → lower `EMBEDDING_BATCH_SIZE`.
- **Switching embedding models** → update `EMBEDDING_MODEL` **and**
  `EMBEDDING_DIM`; the collection is validated and **recreated automatically**
  on startup (§5.6) — then re-embed each document. If the new model isn't
  E5-family, also re-check `RAG_SCORE_THRESHOLD` (score ranges differ).
- **Exact identifiers (notice numbers) not being found** → make sure
  `HYBRID_SEARCH=true` and `fastembed` is installed (check startup logs for
  "Sparse model loaded").

---

## 12. API reference

### NestJS (`:5005`, JWT required)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/documents` | multipart upload (`file`, `title`) → `Document` (PENDING), auto-embeds |
| `GET` | `/documents?page&limit&status` | paginated list |
| `GET` | `/documents/progress/batch?ids=a,b,c` | live progress for many docs (one call) |
| `GET` | `/documents/:id` | single document |
| `GET` | `/documents/:id/progress` | live progress for one doc |
| `POST` | `/documents/:id/embed` | (re-)embed stored file → PROCESSING |
| `POST` | `/documents/:id/unembed` | remove vectors, keep file → UNEMBEDDED |
| `GET` | `/documents/:id/download` | original file |
| `DELETE` | `/documents/:id` | vectors + file + DB row |
| `POST` | `/rag/query` | `{question, documentId?, topK?}` → `{answer, sources, model_used}` |

### Python AI service (`:8000`, internal only)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | `{status, qdrant, model_loaded}` |
| `POST` | `/documents` | multipart (`file`, `document_id?`, `title?`) → extract/chunk/embed/index |
| `GET` | `/progress?ids=a,b,c` | batch progress from the in-memory registry |
| `GET` | `/documents/:id/progress` | single-doc progress |
| `GET` | `/documents/:id/status` | chunk count from Qdrant (`count` by `doc_id`) |
| `DELETE` | `/documents/:id` | delete all points with that `doc_id` |
| `POST` | `/query` | `{question, doc_id?, top_k?, language?}` → answer + sources |

---

## 13. Logging and observability

All AI-service modules log through a namespaced `pnm-ai.*` logger
(`app/logger.py`) with a single stdout handler, so one ingestion reads as a
coherent story:

```
[INFO] pnm-ai.main:      Upload received: doc_id=…, filename=notice.pdf, size=1834122 bytes
[INFO] pnm-ai.extractor: Extracting text from ….pdf (mime=application/pdf)
[INFO] pnm-ai.extractor: Extracted 48213 chars from ….pdf (ocr=False, pages=24)
[INFO] pnm-ai.chunker:   chunk #0: chars 0-509 (509 chars) | GOVERNMENT OF NEPAL Ministry…
[INFO] pnm-ai.chunker:   chunk #1: chars 459-968 (509 chars) | The provisions of this…
…one line per chunk…
[INFO] pnm-ai.chunker:   Chunked 48213 chars into 103 chunks (chunk_size=800, overlap=120)
[INFO] pnm-ai.embeddings: Embedded batch 0-32/103 (2101ms)
[INFO] pnm-ai.embeddings: Embedded batch 32-64/103 (1987ms)
…
[INFO] pnm-ai.store:     Upserted points 0-100/103 for doc_id=…
[INFO] pnm-ai.store:     Indexed 103 chunks for doc_id=…
[INFO] pnm-ai.main:      POST /documents -> 201 (41873ms)
```

Query-side (document question):

```
[INFO] pnm-ai.rag:   RAG query (doc_id=None, top_k=5, lang=en): What are the eligibility…
[INFO] pnm-ai.rag:   Intent (embedding): document (chat=0.791, doc=0.874) for 'What are…'
[INFO] pnm-ai.store: Search (hybrid-rrf) returned 15 hits (top_k=15, doc_id=None)
[INFO] pnm-ai.rag:   Retrieved 15 candidates, kept 5 after threshold/dedup
[INFO] pnm-ai.rag:   RAG query answered from 5 sources (model=llama-3.3-70b-versatile)
```

Query-side (small talk — note: no search, no sources):

```
[INFO] pnm-ai.rag: RAG query (doc_id=None, top_k=5, lang=en): gud mrng ji, hw r u
[INFO] pnm-ai.rag: Intent (LLM tiebreak): chat (chat=0.889, doc=0.879) for 'gud mrng ji…'
[INFO] pnm-ai.rag: Small talk detected (semantic); skipping retrieval
```

The intent lines show both similarity scores, so misroutes are diagnosable from
logs alone (add prototypes to `_CHAT_EXAMPLES`/`_DOC_EXAMPLES` in `rag.py` to
correct them).

Every HTTP request is timed (`%s %s -> %d (%.0fms)`), and every failure path
logs with `logger.exception` before returning a structured JSON error.

---

## 14. Running and troubleshooting

### Start everything

```bash
docker start qdrant-ai                     # vector DB (see QDRANT_SETUP.md)
pnpm dev                                   # web :3000 + api :5005 + ai :8000
# or the AI service alone:
cd apps/ai && .venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

### Quick pipeline smoke test (bypasses auth, talks to AI directly)

```bash
printf 'Test notice. Applications close on Sept 15, 2026. Fee: NPR 1,200.' > /tmp/t.txt
curl -F "file=@/tmp/t.txt;type=text/plain" -F "title=Test" localhost:8000/documents
curl -X POST localhost:8000/query -H 'Content-Type: application/json' \
     -d '{"question":"When do applications close?"}'
```

### Symptom → cause table

| Symptom | Likely cause / fix |
|---|---|
| Answers are raw sentence dumps + amber "Fallback mode" banner | `GROQ_API_KEY` empty in `apps/ai/.env`. Set it, restart the AI service. |
| "Couldn't find anything…" replies for content that exists | Document not `INDEXED` (check toggle), or threshold too high, or the question's language/vocabulary is far from the text. |
| A document question gets a greeting-style reply | Intent router misroute — check the `Intent (…)` log line for the scores and add a matching example to `_DOC_EXAMPLES` in `rag.py`. |
| Upload stuck in `PROCESSING` forever | AI service died mid-ingest. Check its logs; the file is safe — toggle embed to retry. Progress registry is memory-only, so a restart loses the bar but not the document. |
| `Vector dimension error` from Qdrant | `EMBEDDING_DIM` ≠ collection size (model changed?). Recreate the collection and re-embed. |
| Unembed fails with 409 | AI service unreachable — intentional: status won't claim vectors are gone when they aren't. |
| OCR garbage from scans | Tesseract `nep` pack missing (`tesseract --list-langs`), or very low-quality scan. |
| Health shows `"qdrant": false` | Container down (`docker start qdrant-ai`) or `QDRANT_API_KEY` mismatch. |

---

## 15. Known limitations and future work

Honest gaps in the current implementation, roughly ordered by impact:

1. **No streaming answers** — the UI waits for the full Groq response. SSE
   token streaming would cut perceived latency dramatically.
2. **No conversation memory** — each query is independent; follow-up questions
   ("what about the fee?") lose the referent. Fix: send recent turns and let
   the LLM (or a cheap rewrite step) resolve the question before retrieval.
3. ~~**Semantic-only retrieval**~~ — **implemented**: hybrid search (BM25
   sparse + dense vectors, fused with RRF) is now the default; set
   `HYBRID_SEARCH=false` to disable. Fused hits are re-scored with true
   cosine so the threshold and UI relevance stay meaningful.
4. **No reranker** — a cross-encoder (e.g. `bge-reranker-v2-m3`) over the ~15
   candidates would improve top-5 precision at modest CPU cost.
5. **Character-based chunking** — token-aware chunking (respecting the
   embedding model's 512-token window) would embed long chunks with
   less truncation loss.
6. **In-memory progress** — lost on AI restart (mitigated by the UI's periodic
   list refresh). A Redis-backed registry would survive restarts.
7. **Single-process ingestion** — one document embeds at a time per worker;
   a queue (BullMQ on the Nest side, or Celery/arq on the Python side) would
   give parallelism, retries, and back-pressure.
8. **No evaluation harness** — retrieval/answer quality changes are eyeballed.
   A small golden-question set with expected sources would catch regressions.
9. **OCR quality is unverified** — no confidence scores surfaced; low-confidence
   pages could be flagged for manual review.
