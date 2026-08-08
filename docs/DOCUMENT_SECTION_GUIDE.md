# Document Intelligence & RAG — Full Implementation Guide

> Complete technical reference for the Document upload, indexing, and Retrieval-Augmented Generation system.
> Part of: AI-Powered Cloud-Based Public Notice Management System for Nepal

---

## Table of Contents

1. [System Overview & Data Flow](#1-system-overview--data-flow)
2. [Architecture Decisions](#2-architecture-decisions)
3. [Python AI Service (apps/ai)](#3-python-ai-service-appsai)
   - [3.1 Configuration](#31-configuration)
   - [3.2 Text Extraction](#32-text-extraction)
   - [3.3 Text Chunking](#33-text-chunking)
   - [3.4 Embeddings](#34-embeddings)
   - [3.5 Vector Store (Qdrant)](#35-vector-store-qdrant)
   - [3.6 LLM Generation (Groq)](#36-llm-generation-groq)
   - [3.7 RAG Pipeline](#37-rag-pipeline)
   - [3.8 ASGI Application & Endpoints](#38-asgi-application--endpoints)
4. [NestJS API Gateway (apps/api)](#4-nestjs-api-gateway-appsapi)
   - [4.1 Database Schema (Prisma)](#41-database-schema-prisma)
   - [4.2 Documents Module](#42-documents-module)
   - [4.3 RAG Module](#43-rag-module)
   - [4.4 Validation DTOs](#44-validation-dtos)
5. [Frontend Integration (apps/web)](#5-frontend-integration-appsweb)
   - [5.1 API Client Functions](#51-api-client-functions)
   - [5.2 TypeScript Types](#52-typescript-types)
   - [5.3 Page Behavior](#53-page-behavior)
6. [Complete Request Flows](#6-complete-request-flows)
7. [Error Handling & Resilience](#7-error-handling--resilience)
8. [Environment Configuration](#8-environment-configuration)
9. [Running the System](#9-running-the-system)
10. [Dependencies](#10-dependencies)

---

## 1. System Overview & Data Flow

The Document section implements a three-tier RAG system where:

- **Frontend (Next.js)** handles user interaction — file upload UI, chat interface, document library
- **API Gateway (NestJS)** handles authentication, validation, file persistence, database records, and proxies to the AI service
- **AI Service (Python)** handles all ML/AI operations — text extraction, OCR, chunking, embedding, vector storage, similarity search, and LLM answer generation

```
┌────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT UPLOAD FLOW                            │
└────────────────────────────────────────────────────────────────────────┘

Browser (Next.js)                NestJS API (:5005)              Python AI (:8000)
      │                               │                               │
      │  POST /documents              │                               │
      │  (multipart: file + title)    │                               │
      │──────────────────────────────▶│                               │
      │                               │                               │
      │                               │ 1. Validate file type/size    │
      │                               │ 2. Save to disk (uploads/)    │
      │                               │ 3. Create DB record           │
      │                               │    (status: PENDING)          │
      │                               │                               │
      │  ◀─── 201 { document }────────│                               │
      │                               │                               │
      │                               │── ASYNC (non-blocking) ──────▶│
      │                               │   POST /documents             │
      │                               │   (multipart: file stream)    │
      │                               │                               │
      │                               │   Update status: PROCESSING   │
      │                               │                               │
      │                               │                    ┌──────────┤
      │                               │                    │ Extract  │
      │                               │                    │ Chunk    │
      │                               │                    │ Embed    │
      │                               │                    │ Index    │
      │                               │                    └──────────┤
      │                               │                               │
      │                               │◀─── { doc_id, chunk_count,   │
      │                               │       text_length, is_ocr }   │
      │                               │                               │
      │                               │ Update DB: status=INDEXED      │
      │                               │ chunkCount, textLength, isOcr │
      │                               │ indexedAt = now()              │
      │                               │                               │
      │  (Frontend polls GET /documents to see status change)         │
      │                               │                               │

┌────────────────────────────────────────────────────────────────────────┐
│                          RAG QUERY FLOW                                 │
└────────────────────────────────────────────────────────────────────────┘

Browser                          NestJS API                    Python AI
      │                               │                               │
      │  POST /rag/query              │                               │
      │  { question, documentId? }    │                               │
      │──────────────────────────────▶│                               │
      │                               │                               │
      │                               │  POST /query                  │
      │                               │  { question, doc_id?, top_k } │
      │                               │──────────────────────────────▶│
      │                               │                               │
      │                               │                    ┌──────────┤
      │                               │                    │ 1. Embed │
      │                               │                    │    query │
      │                               │                    │ 2. Qdrant│
      │                               │                    │    search│
      │                               │                    │ 3. LLM   │
      │                               │                    │    answer│
      │                               │                    └──────────┤
      │                               │                               │
      │                               │◀── { answer, sources,        │
      │                               │      model_used }             │
      │                               │                               │
      │◀── { answer, sources,         │                               │
      │      model_used }             │                               │
```

---

## 2. Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Vector DB | **Qdrant** (not ChromaDB) | Production-ready, horizontally scalable, Rust-based, free self-host + free 1 GB cloud tier. ChromaDB is in-process and not suitable for production. |
| Embedding model | **paraphrase-multilingual-MiniLM-L12-v2** | 384-dim vectors, supports 50+ languages including Nepali, runs locally (no API cost), fast inference |
| LLM for answers | **Groq API (llama-3.1-8b-instant)** | Free tier with generous limits, extremely fast inference (~200ms), no GPU needed locally, falls back to extractive answers if unavailable |
| Python framework | **Raw ASGI (uvicorn)** | Deliberately framework-light per project spec. No FastAPI dependency — fewer moving parts, full control over multipart parsing |
| File storage | **Local disk** (S3-ready) | `uploads/` directory with UUID filenames. The filePath is stored in Prisma so switching to S3 requires only changing the storage driver |
| Processing model | **Synchronous in AI, async from API** | NestJS fires-and-forgets the AI call so the upload response is instant. The AI service processes synchronously (simpler, no job queue needed at this scale) |
| ID consistency | **Prisma UUID passed to Qdrant** | The same document ID exists in PostgreSQL and as the `doc_id` field in all Qdrant points, enabling consistent cross-system queries and deletions |

---

## 3. Python AI Service (apps/ai)

### 3.1 Configuration

**File:** `app/config.py`

All configuration is loaded from environment variables at module import time:

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `8000` | Uvicorn listen port |
| `ENVIRONMENT` | `development` | Runtime environment identifier |
| `EMBEDDING_MODEL` | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` | HuggingFace model ID for embeddings |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server address |
| `QDRANT_COLLECTION` | `documents` | Qdrant collection name |
| `CHUNK_SIZE` | `512` | Maximum characters per chunk |
| `CHUNK_OVERLAP` | `50` | Overlap characters between adjacent chunks |
| `GROQ_API_KEY` | (empty) | Groq API key; if unset, falls back to extractive answers |
| `TESSERACT_LANG` | `nep+eng` | Tesseract language packs (Nepali + English) |
| `UPLOAD_DIR` | `./data/uploads` | Directory for uploaded files |
| `CORS_ORIGINS` | `http://localhost:3000,http://localhost:5005` | Allowed CORS origins |

The `ensure_upload_dir()` function creates the upload directory tree if it doesn't exist, called during ASGI lifespan startup.

---

### 3.2 Text Extraction

**File:** `app/extractor.py`

Handles four document types with a unified interface:

```python
def extract_text(file_path: str, mime_type: str) -> dict:
    # Returns: {"text": str, "is_ocr": bool, "page_count": int}
```

**PDF Extraction Strategy (two-pass):**
1. First attempt: `pypdf.PdfReader` extracts text from each page
2. Quality check: if average text per page < 100 characters, assume scanned document
3. Fallback: OCR pipeline — `pdf2image.convert_from_path()` renders pages to images, then `pytesseract.image_to_string()` with configured language packs (`nep+eng`)
4. Sets `is_ocr=True` when fallback is used

**DOCX Extraction:**
- `python-docx` loads the document
- Iterates `doc.paragraphs`, joins with newlines
- Sets `page_count=1` (DOCX doesn't have native page markers)

**Image Extraction (PNG/JPEG):**
- Direct OCR via `pytesseract.image_to_string(Image.open(path))`
- Always sets `is_ocr=True`

**Plain Text:**
- Reads with UTF-8 encoding, falls back to Latin-1 if decode fails
- No OCR needed

---

### 3.3 Text Chunking

**File:** `app/chunker.py`

```python
def chunk_text(text: str, chunk_size: int = 512, overlap: int = 50) -> list[dict]:
    # Returns: [{"content": str, "index": int, "char_start": int, "char_end": int}]
```

**Algorithm — hierarchical splitting:**

1. **Split by paragraphs** (double newlines `\n\n`)
2. For each paragraph:
   - If it fits within `chunk_size` → add directly as a chunk
   - If too large → **split by sentences** using regex that respects:
     - English punctuation: `.` `!` `?` followed by space or newline
     - Nepali punctuation: `।` (Devanagari danda)
   - Accumulate sentences until the buffer exceeds `chunk_size`, then flush
3. For individual sentences that still exceed `chunk_size`:
   - **Split by words** as a last resort
   - Accumulate words until buffer is full

**Overlap handling:**
- After flushing a chunk, the last `overlap` characters are prepended to the next chunk
- This ensures context continuity at chunk boundaries (important for RAG retrieval quality)

**Output metadata:**
- `char_start` / `char_end`: character offsets in the original text (for source highlighting)
- `index`: sequential chunk number within the document

---

### 3.4 Embeddings

**File:** `app/embeddings.py`

**Singleton pattern** — the model is loaded once on first use and reused:

```python
_model = None  # Lazy-loaded

def get_embedding(text: str) -> list[float]:
    # Returns normalized 384-dimensional vector

def get_embeddings(texts: list[str]) -> list[list[float]]:
    # Batch embedding — more efficient for multiple texts

def is_loaded() -> bool:
    # Health check for the /health endpoint
```

**Model details:**
- `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`
- Output dimension: **384**
- Supports: 50+ languages including Nepali, English, Hindi
- Runs on CPU — no GPU required
- First load: ~2-5 seconds (downloads model if not cached)
- Subsequent embeddings: ~5-50ms per text depending on length

**Normalization:**
- All vectors are L2-normalized after encoding (`normalize_embeddings=True`)
- This is required for cosine similarity to work correctly in Qdrant

---

### 3.5 Vector Store (Qdrant)

**File:** `app/store.py`

**Collection configuration:**
- Name: configurable via `QDRANT_COLLECTION` (default: `documents`)
- Vector size: `384` (matches MiniLM output)
- Distance metric: `COSINE`
- Auto-created on startup if not present

**Indexing (`index_document`):**
```python
def index_document(doc_id: str, chunks: list[dict], embeddings: list[list[float]], metadata: dict) -> int:
```

- Creates one Qdrant `PointStruct` per chunk
- **Point ID**: deterministic UUID5 derived from `f"{doc_id}:{chunk_index}"` — ensures idempotent re-indexing
- **Payload** stored per point:
  - `doc_id` — links back to PostgreSQL Document.id
  - `chunk_index` — position within the document
  - `content` — the actual text chunk (for retrieval without re-reading files)
  - `char_start`, `char_end` — character offsets
  - `original_filename`, `mime_type` — from upload metadata
  - `title` — document title (if provided)
- **Batch upsert**: points are uploaded in batches of 100 to avoid memory issues with large documents

**Search (`search`):**
```python
def search(query_embedding: list[float], top_k: int = 5, filter_doc_id: str = None) -> list[dict]:
```

- Uses `client.query_points()` for similarity search
- Optional `filter_doc_id`: creates a `Filter` with `FieldCondition(key="doc_id", match=MatchValue(value=...))` to restrict results to a single document
- Returns list of `{content, score, doc_id, chunk_index, metadata}`
- Score range: 0.0 (no similarity) to 1.0 (identical) for cosine

**Deletion (`delete_document`):**
- Removes all points matching `doc_id` field via filter-based delete
- No need to know individual point IDs

**Health check (`is_connected`):**
- Attempts `client.get_collections()` — if it succeeds, Qdrant is reachable

---

### 3.6 LLM Generation (Groq)

**File:** `app/llm.py`

**Configuration:**
- API endpoint: `https://api.groq.com/openai/v1/chat/completions`
- Model: `llama-3.1-8b-instant`
- Temperature: `0.3` (low for factual accuracy)
- Max tokens: `1024`
- Timeout: `30 seconds`

**System prompt:**
```
You are a helpful assistant answering questions about Nepalese public notices
and government documents. Answer based ONLY on the provided context.
If the context doesn't contain enough information, say so.
Be concise and cite which source chunks you used.
```

**Language support:**
- If `language="ne"`, appends: `" Respond in Nepali (Devanagari script)."`
- Enables bilingual operation for Nepali government documents

**Context formatting:**
```
[Source 1]: <chunk text>

---

[Source 2]: <chunk text>

---

[Source 3]: <chunk text>
```

**Fallback behavior:**
- If `GROQ_API_KEY` is empty OR the API call returns non-200 → falls back to extractive answer
- Extractive answer = top-k chunks concatenated with source labels (no LLM, no cost, deterministic)

---

### 3.7 RAG Pipeline

**File:** `app/rag.py`

The main orchestration function:

```python
async def query(question: str, doc_id: str = None, top_k: int = 5, language: str = "en") -> dict:
```

**Pipeline steps:**

1. **Embed the question** — `embeddings.get_embedding(question)` → 384-dim vector
2. **Similarity search** — `store.search(query_embedding, top_k, filter_doc_id=doc_id)` → ranked chunks
3. **Early exit** — if no results found, return "No relevant documents found" with empty sources
4. **Generate answer** — `llm.generate_answer(question, context_chunks, language)` → natural language answer (or extractive fallback)
5. **Format response:**

```json
{
  "answer": "The Constitution of Nepal 2072 establishes...",
  "sources": [
    {
      "doc_id": "uuid-here",
      "chunk_index": 4,
      "content": "Article 18 guarantees...",
      "score": 0.87
    }
  ],
  "model_used": "llama-3.1-8b-instant"
}
```

---

### 3.8 ASGI Application & Endpoints

**File:** `app/main.py`

Raw ASGI application — no framework. Handles HTTP request routing, CORS, multipart parsing, and lifespan management.

**Lifespan (startup):**
1. Create upload directory (`config.ensure_upload_dir()`)
2. Ensure Qdrant collection exists (`store.ensure_collection()`) — graceful if Qdrant is down

**Routing:**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Service info: name, version, status |
| `GET` | `/health` | Health: `{status, qdrant: bool, model_loaded: bool}` |
| `POST` | `/documents` | Upload & index a document |
| `GET` | `/documents/{id}/status` | Check indexing status & chunk count |
| `DELETE` | `/documents/{id}` | Remove document from vector store |
| `POST` | `/query` | RAG question answering |
| `OPTIONS` | `*` | CORS preflight response |

**POST /documents — Multipart upload flow:**

1. Validate `Content-Type: multipart/form-data` with boundary
2. Parse multipart body manually (custom `_parse_multipart()`)
3. Extract fields:
   - `file` (required): binary file data + filename + content-type
   - `document_id` (optional): if provided by NestJS, use it; otherwise generate UUID
   - `title` (optional): stored in metadata
   - `metadata` (optional): JSON object merged into point payloads
4. Save file to `UPLOAD_DIR/{doc_id}{extension}`
5. Extract text → chunk → embed → index in Qdrant
6. Return `201 Created` with results or appropriate error code

**POST /query — JSON body:**

```json
{
  "question": "What are fundamental rights?",
  "doc_id": "optional-uuid",
  "top_k": 5,
  "language": "en"
}
```

**CORS middleware:**
- Validates `Origin` header against configured `CORS_ORIGINS`
- Returns appropriate `Access-Control-Allow-*` headers
- `OPTIONS` requests get a `204 No Content` preflight response

---

## 4. NestJS API Gateway (apps/api)

### 4.1 Database Schema (Prisma)

**File:** `prisma/schema.prisma`

```prisma
enum DocumentStatus {
  PENDING       // Just uploaded, not yet sent to AI
  PROCESSING    // Sent to AI, awaiting results
  INDEXED       // Successfully processed and indexed in Qdrant
  FAILED        // Processing failed (AI service error, extraction error, etc.)
}

model Document {
  id          String         @id @default(uuid()) @db.Uuid
  title       String                              // User-provided title
  filename    String                              // Original filename
  mimeType    String         @map("mime_type")    // e.g. "application/pdf"
  fileSize    Int            @map("file_size")    // Bytes
  filePath    String         @map("file_path")    // Absolute path on disk
  status      DocumentStatus @default(PENDING)
  isOcr       Boolean        @default(false) @map("is_ocr")
  textLength  Int?           @map("text_length")  // Characters extracted
  chunkCount  Int?           @map("chunk_count")  // Chunks in Qdrant
  uploadedBy  String         @map("uploaded_by") @db.Uuid
  user        User           @relation(fields: [uploadedBy], references: [id])
  createdAt   DateTime       @default(now()) @map("created_at")
  updatedAt   DateTime       @updatedAt @map("updated_at")
  indexedAt   DateTime?      @map("indexed_at")   // When indexing completed

  @@map("documents")
}
```

**Relationship:** Each Document belongs to a User (`uploadedBy` FK → User.id). The User model has `documents Document[]` for the reverse relation.

---

### 4.2 Documents Module

**Files:**
- `src/modules/documents.module.ts` — Module definition
- `src/controllers/documents.controller.ts` — HTTP endpoints
- `src/services/documents.service.ts` — Business logic

#### Controller Endpoints

All endpoints require JWT authentication (`@UseGuards(JwtAuthGuard)` at class level). Any authenticated user can upload, list, and delete documents.

**`POST /documents`** — Upload a document

- Uses `@UseInterceptors(FileInterceptor('file', { storage, limits, fileFilter }))`
- **Multer config:**
  - Storage: disk at `apps/api/uploads/`
  - Filename: `{uuid}{extension}` (collision-free)
  - Max size: 50 MB
  - Allowed MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`, `image/png`, `image/jpeg`
- Request body (form fields): `title` (validated via UploadDocumentDto)
- Creates Prisma Document record with `status: PENDING`
- Triggers async processing (does NOT block response)
- Returns the Document object immediately

**`GET /documents`** — List documents (paginated)

- Query params: `page` (default 1), `limit` (default 20, max 100), `status` (optional filter)
- Returns: `{ data: Document[], meta: { page, limit, total, totalPages } }`
- Includes related `user` with `{ id, name, email }`
- Ordered by `createdAt DESC`

**`GET /documents/:id`** — Get single document

- Validates UUID format via `ParseUUIDPipe`
- Returns full Document with user info
- Throws `404 NotFoundException` if not found

**`DELETE /documents/:id`** — Delete document

- Three-phase deletion:
  1. Call AI service `DELETE /documents/{id}` (graceful — continues even if AI service is down)
  2. Delete file from disk (graceful — continues if file already removed)
  3. Delete Prisma record
- Returns `{ message: "Document deleted successfully" }`

**`GET /documents/:id/download`** — Download original file

- Streams file with correct `Content-Type` and `Content-Disposition` headers
- Uses `res.sendFile(absolutePath)`

#### Service — Async Processing

The critical `processDocument()` method:

```typescript
async processDocument(document: Document): Promise<void> {
  // 1. Mark as PROCESSING
  await this.prisma.document.update({
    where: { id: document.id },
    data: { status: DocumentStatus.PROCESSING },
  });

  // 2. Stream file to AI service
  const form = new FormData();
  form.append('file', fs.createReadStream(fullPath), { filename, contentType });
  form.append('document_id', document.id);   // Same UUID for Qdrant
  form.append('title', document.title);

  const response = await this.httpService.post(
    `${aiServiceUrl}/documents`, form,
    { headers: form.getHeaders(), timeout: 120000 }
  );

  // 3. Update with results
  await this.prisma.document.update({
    where: { id: document.id },
    data: {
      status: DocumentStatus.INDEXED,
      chunkCount: response.data.chunk_count,
      textLength: response.data.text_length,
      isOcr: response.data.is_ocr,
      indexedAt: new Date(),
    },
  });
}
```

**Key design:** The `document.id` (Prisma UUID) is sent as `document_id` to the AI service, which uses it as the `doc_id` field in Qdrant. This means the same UUID exists in PostgreSQL and Qdrant, enabling consistent queries and deletions.

---

### 4.3 RAG Module

**Files:**
- `src/modules/rag.module.ts` — Module definition
- `src/controllers/rag.controller.ts` — Single endpoint
- `src/services/rag.service.ts` — AI service proxy

#### Controller

```typescript
@Controller('rag')
@UseGuards(JwtAuthGuard)
export class RagController {
  @Post('query')
  async query(@Body() dto: RagQueryDto) {
    return this.ragService.query(dto.question, dto.documentId, dto.topK);
  }
}
```

#### Service

```typescript
async query(question: string, documentId?: string, topK?: number): Promise<RagQueryResult> {
  const payload = { question };
  if (documentId) payload.doc_id = documentId;
  if (topK) payload.top_k = topK;

  const response = await this.httpService.post(`${aiServiceUrl}/query`, payload, {
    timeout: 60000,
  });

  return {
    answer: response.data.answer,
    sources: response.data.sources,
    model_used: response.data.model_used,
  };
}
```

**Error handling:** If the AI service is unreachable (`ECONNREFUSED`), returns a graceful message instead of throwing — the frontend shows "AI service unavailable" rather than a generic error.

---

### 4.4 Validation DTOs

**UploadDocumentDto:**
```typescript
title: string  // @IsString, @IsNotEmpty, @MaxLength(200)
```

**ListDocumentsDto:**
```typescript
page?: number    // @IsOptional, @Type(() => Number), @IsInt, @Min(1), default 1
limit?: number   // @IsOptional, @Type(() => Number), @IsInt, @Min(1), @Max(100), default 20
status?: DocumentStatus  // @IsOptional, @IsEnum(DocumentStatus)
```

**RagQueryDto:**
```typescript
question: string      // @IsString, @IsNotEmpty
documentId?: string   // @IsOptional, @IsUUID
topK?: number         // @IsOptional, @Type(() => Number), @IsInt, @Min(1), @Max(50)
```

All DTOs use `class-validator` decorators. The global `ValidationPipe` in `main.ts` is configured with `whitelist: true` (strips unknown fields) and `forbidNonWhitelisted: true` (rejects requests with extra fields).

---

## 5. Frontend Integration (apps/web)

### 5.1 API Client Functions

**File:** `lib/api.ts`

```typescript
// Upload a document (multipart FormData — no Content-Type header, browser sets boundary)
uploadDocument(file: File, title: string): Promise<RagDocument>

// List documents with pagination and optional status filter
fetchDocuments(page?: number, limit?: number, status?: DocumentStatus): Promise<RagDocumentListResponse>

// Get single document details
fetchDocument(id: string): Promise<RagDocument>

// Delete a document (removes from DB, disk, and vector store)
deleteDocument(id: string): Promise<void>

// Send a RAG query — returns answer + sources
ragQuery(question: string, documentId?: string, topK?: number): Promise<RagQueryResponse>
```

**Authentication:** All functions use `tokenStore.get()` to attach `Authorization: Bearer <jwt>` header. The `uploadDocument` function uses raw `fetch` with `FormData` (not `apiFetch`) because `apiFetch` sets `Content-Type: application/json` which breaks multipart uploads.

---

### 5.2 TypeScript Types

**File:** `lib/types.ts`

```typescript
type DocumentStatus = "PENDING" | "PROCESSING" | "INDEXED" | "FAILED"

interface RagDocument {
  id: string
  title: string
  filename: string
  mimeType: string
  fileSize: number           // bytes
  status: DocumentStatus
  isOcr: boolean
  textLength: number | null
  chunkCount: number | null
  uploadedBy: string
  createdAt: string          // ISO 8601
  updatedAt: string
  indexedAt: string | null
  user?: { id: string; name: string; email: string }
}

interface RagDocumentListResponse {
  data: RagDocument[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

interface RagSource {
  doc_id: string
  chunk_index: number
  content: string
  score: number              // 0.0 to 1.0 (cosine similarity)
}

interface RagQueryResponse {
  answer: string
  sources: RagSource[]
  model_used: string | null  // "llama-3.1-8b-instant", "extractive", or null
}

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  sources?: RagSource[]      // Attached to assistant messages
}
```

---

### 5.3 Page Behavior

**File:** `app/rag/page.tsx`

**State management:**
- `docs: RagDocument[]` — full document list, loaded on mount
- `messages: ChatMessage[]` — conversation history (client-side only)
- `selectedDocId` — optional filter for document-specific queries
- `docsLoading` / `typing` — loading states

**Polling:**
- On mount: fetches all documents once
- If any document has `status: PENDING | PROCESSING`: polls every 5 seconds to detect status changes
- Polling stops automatically when no documents are in-progress

**Upload flow:**
1. User clicks "Upload" → modal opens with drag-and-drop zone
2. User selects file (drag-drop or click) + enters title (auto-filled from filename)
3. Submit → `uploadDocument(file, title)` → API returns Document with `status: PENDING`
4. Modal closes, doc list refreshes
5. Polling picks up status change to INDEXED within ~5 seconds

**Query flow:**
1. User types question or clicks suggestion
2. User message added to chat immediately
3. `ragQuery(question, selectedDocId)` called
4. On success: assistant message added with answer + sources array
5. On error: assistant message shows friendly error text
6. Sources displayed as badges below the answer (source index + match score %)

**Document-specific queries:**
- Clicking "Ask AI" on a DocCard sets `selectedDocId`
- All subsequent queries include this `documentId` parameter
- The AI service filters Qdrant search to only that document's chunks
- A "Filtered" badge appears in the chat header with an X to clear

---

## 6. Complete Request Flows

### Flow A: Document Upload (success path)

```
1. Browser → POST /documents (multipart: file=budget.pdf, title="Budget FY 2082/83")
2. NestJS:
   - multer saves file as /uploads/a1b2c3d4.pdf
   - Prisma creates Document { id: "a1b2c3d4-...", status: PENDING }
   - Returns 201 { id, title, status: "PENDING", ... }
   - Fires async: processDocument(document)
3. NestJS (async):
   - Updates status → PROCESSING
   - POSTs file to Python AI service /documents
4. Python AI:
   - Receives multipart, extracts doc_id from form field
   - pypdf extracts text (4200 chars) → not OCR
   - Chunks into 9 chunks (512 char, 50 overlap)
   - Embeds 9 chunks (384-dim each) via MiniLM
   - Upserts 9 PointStructs into Qdrant collection
   - Returns 201 { doc_id, text_length: 4200, chunk_count: 9, is_ocr: false }
5. NestJS (async):
   - Updates Document: status=INDEXED, chunkCount=9, textLength=4200,
     isOcr=false, indexedAt=now()
6. Browser (polling):
   - GET /documents → sees status changed to INDEXED
   - Shows green "9 chunks" badge on the document card
```

### Flow B: RAG Query (with LLM)

```
1. Browser → POST /rag/query { question: "What is the education budget?", topK: 5 }
2. NestJS:
   - Validates DTO
   - Forwards to AI: POST /query { question, top_k: 5 }
3. Python AI:
   - Embeds question → 384-dim vector
   - Qdrant search (top-5, cosine) → 5 ranked chunks
   - Formats context with source labels
   - Calls Groq API (llama-3.1-8b-instant, temp=0.3, max_tokens=1024)
   - Groq returns synthesized answer
   - Returns { answer, sources: [...], model_used: "llama-3.1-8b-instant" }
4. NestJS → Browser:
   - Returns same response
5. Browser:
   - Renders answer in chat bubble
   - Shows source badges: "Source 3 · 92%", "Source 1 · 87%", "Source 5 · 81%"
```

### Flow C: RAG Query (extractive fallback — no Groq key)

```
Same as Flow B except:
3. Python AI:
   - GROQ_API_KEY is empty (or API returns error)
   - Falls back to extractive answer:
     "[Source 1]: The Ministry of Education has allocated...\n\n
      [Source 2]: Budget allocation for..."
   - model_used = "extractive"
```

### Flow D: Document Deletion

```
1. Browser → DELETE /documents/a1b2c3d4-...
2. NestJS:
   - Calls AI: DELETE /documents/a1b2c3d4-...
     (removes all matching points from Qdrant)
   - Deletes file: /uploads/a1b2c3d4.pdf
   - Deletes Prisma record
   - Returns { message: "Document deleted successfully" }
3. Browser:
   - Removes document from local state array
```

---

## 7. Error Handling & Resilience

| Scenario | Handling |
|----------|----------|
| AI service is down during upload | Document stays in DB. NestJS marks as `FAILED`. Frontend shows "Failed" badge. |
| AI service is down during query | NestJS catches `ECONNREFUSED`, returns `{ answer: "AI service unavailable...", sources: [], model_used: "none" }` |
| Groq API is down or key missing | Python AI falls back to extractive answer. No error shown to user — just raw chunk text. |
| Qdrant is down during upload | Python AI returns `503`. NestJS marks document as `FAILED`. |
| Qdrant is down during query | Python AI returns `500`. NestJS propagates → Frontend shows error in chat. |
| File extraction fails (corrupt PDF) | Python AI returns `422`. NestJS marks document as `FAILED`. |
| No text extracted (blank pages) | Python AI returns `422` with message. NestJS marks as `FAILED`. |
| Upload timeout (>2 minutes) | NestJS HttpService times out. Document marked `FAILED`. |
| Query timeout (>60 seconds) | NestJS HttpService times out. Error propagated to frontend. |
| AI service delete fails during removal | NestJS logs warning, continues with disk + DB deletion (orphan in Qdrant is acceptable). |
| Invalid file type | Multer rejects with `400` before any processing. |
| File too large (>50MB) | Multer rejects with `413` before any processing. |

---

## 8. Environment Configuration

### apps/ai/.env
```bash
PORT=8000
ENVIRONMENT=development
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=documents
CHUNK_SIZE=512
CHUNK_OVERLAP=50
GROQ_API_KEY=gsk_xxxxxxxxxxxx          # Get free from console.groq.com
TESSERACT_LANG=nep+eng
UPLOAD_DIR=./data/uploads
CORS_ORIGINS=http://localhost:3000,http://localhost:5005
```

### apps/api/.env
```bash
PORT=5005
DATABASE_URL=postgresql://postgres:password@localhost:5432/govnotice
GOOGLE_CLIENT_ID=your-google-client-id
JWT_SECRET=your-jwt-secret
ADMIN_EMAILS=admin@example.com
WEB_ORIGIN=http://localhost:3000
AI_SERVICE_URL=http://localhost:8000
```

### apps/web/.env.local
```bash
NEXT_PUBLIC_API_URL=http://localhost:5005
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

---

## 9. Running the System

### Prerequisites
- Node.js 18+, pnpm 10+
- Python 3.10+
- PostgreSQL 14+
- Qdrant (Docker recommended)
- Tesseract OCR with Nepali language pack

### Step-by-step

```bash
# 1. Start Qdrant (Docker)
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 qdrant/qdrant

# 2. Ensure PostgreSQL is running with the govnotice database

# 3. Install all dependencies
pnpm install

# 4. Setup Python AI service
cd apps/ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd ../..

# 5. Run database migration
cd apps/api
npx prisma migrate dev
cd ../..

# 6. Start all services (via Turborepo)
pnpm dev
```

This starts:
- Next.js frontend on `:3000`
- NestJS API on `:5005`
- Python AI service on `:8000`

### Installing Tesseract

**macOS:**
```bash
brew install tesseract
brew install tesseract-lang    # Includes Nepali
```

**Ubuntu/Debian:**
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-nep
```

### Getting a Groq API Key (free)
1. Go to https://console.groq.com
2. Sign up (free, no credit card)
3. Generate an API key
4. Set `GROQ_API_KEY` in `apps/ai/.env`

Without Groq key the system still works — answers are extractive (raw chunk text) instead of LLM-synthesized.

---

## 10. Dependencies

### Python AI Service

| Package | Version | Purpose |
|---------|---------|---------|
| uvicorn | >=0.30.0 | ASGI server |
| httpx | >=0.27.0 | Async HTTP client (Groq API calls) |
| python-multipart | >=0.0.9 | Multipart form parsing |
| pypdf | >=4.0.0 | PDF text extraction |
| python-docx | >=1.1.0 | DOCX text extraction |
| pytesseract | >=0.3.10 | OCR (Tesseract Python wrapper) |
| pdf2image | >=1.17.0 | PDF page → image for OCR |
| Pillow | >=10.0.0 | Image processing |
| sentence-transformers | >=3.0.0 | Embedding model (MiniLM) |
| qdrant-client | >=1.9.0 | Qdrant vector DB client |
| numpy | >=1.26.0 | Numerical operations |

### NestJS API (Document-specific)

| Package | Version | Purpose |
|---------|---------|---------|
| @nestjs/axios | ^4.0.1 | HTTP client for AI service |
| axios | ^1.18.1 | Underlying HTTP library |
| multer | ^2.2.0 | Multipart file upload |
| form-data | ^4.0.6 | FormData for forwarding files |
| uuid | ^14.0.1 | UUID generation for filenames |
| @prisma/client | ^6.2.0 | Database ORM |

### Frontend

No additional packages beyond the existing Next.js setup — uses native `fetch` API and React state.

---

## Appendix: File Map

```
apps/
├── ai/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py        ← Environment configuration
│   │   ├── extractor.py     ← PDF/DOCX/Image/TXT text extraction + OCR
│   │   ├── chunker.py       ← Paragraph-aware text chunking with overlap
│   │   ├── embeddings.py    ← Sentence-transformers model (MiniLM, 384-dim)
│   │   ├── store.py         ← Qdrant vector store interface
│   │   ├── llm.py           ← Groq API client (llama-3.1-8b-instant)
│   │   ├── rag.py           ← RAG orchestration pipeline
│   │   └── main.py          ← ASGI app, routing, multipart parsing, CORS
│   ├── data/uploads/         ← Runtime: uploaded files stored here
│   ├── requirements.txt
│   └── .env.example
│
├── api/
│   ├── prisma/
│   │   └── schema.prisma    ← Document model + DocumentStatus enum
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── documents.controller.ts  ← CRUD + upload + download
│   │   │   └── rag.controller.ts        ← POST /rag/query
│   │   ├── services/
│   │   │   ├── documents.service.ts     ← Business logic + async AI processing
│   │   │   └── rag.service.ts           ← AI service proxy
│   │   ├── modules/
│   │   │   ├── documents.module.ts
│   │   │   └── rag.module.ts
│   │   └── dto/
│   │       ├── upload-document.dto.ts
│   │       ├── list-documents.dto.ts
│   │       └── rag-query.dto.ts
│   └── uploads/              ← Runtime: uploaded files stored here
│
└── web/
    ├── app/rag/page.tsx      ← Document Intelligence UI (library + chat)
    └── lib/
        ├── api.ts            ← uploadDocument, fetchDocuments, ragQuery, etc.
        └── types.ts          ← RagDocument, RagSource, ChatMessage, etc.
```
