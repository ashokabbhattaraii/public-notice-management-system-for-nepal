# Document (RAG) Pipeline

This document describes how a document travels from upload to being queryable via
RAG across the three services in the monorepo:

- **web** (`apps/web`) — Next.js frontend, upload UI + chat UI
- **api** (`apps/api`) — NestJS backend, owns document records + proxies to AI
- **ai** (`apps/ai`) — Python ASGI service, does extraction, embedding, retrieval, generation
- **Qdrant** — vector store (dense + BM25 sparse), **Groq** — LLM for answer generation

There are two flows: **Ingestion** (indexing a document) and **Query** (asking questions).

---

## 1. Ingestion Pipeline

```mermaid
flowchart TD
    subgraph WEB[apps/web]
        U[User selects file] --> UP[POST /documents multipart]
    end

    subgraph API[apps/api - NestJS]
        UP --> CTRL[DocumentsController.upload<br/>JwtAuthGuard + FileInterceptor]
        CTRL -->|validate mime + size<br/>PDF/DOCX/TXT/PNG/JPEG, max 50MB| DISK[(Save file to disk<br/>uploads/uuid.ext)]
        DISK --> DBROW[DocumentsService.create<br/>Prisma: Document row status=PENDING]
        DBROW --> RESP[Return document to web]
        DBROW -.async, non-blocking.-> PROC[processDocument<br/>status=PROCESSING]
        PROC --> FORM[Build multipart FormData<br/>file + document_id + title]
        FORM -->|HTTP POST AI_SERVICE_URL/documents<br/>timeout 10min| AIUP
    end

    subgraph AI[apps/ai - Python ASGI]
        AIUP[_upload_document<br/>parse multipart] --> SAVE[(Save to data/uploads/<br/>doc_id.ext)]
        SAVE --> PSTART[progress.start]
        PSTART --> THREAD[asyncio.to_thread<br/>_ingest_document - CPU bound]
        THREAD --> EXT[extractor.extract_text]
        EXT --> CHUNK[chunker.chunk_text<br/>CHUNK_SIZE=800, OVERLAP=120]
        CHUNK --> EMB[embeddings.get_embeddings<br/>multilingual-e5-base, 768-dim dense]
        EMB --> IDX[store.index_document]
        IDX --> FIN[progress.finish<br/>return chunk_count, text_length, is_ocr]
    end

    subgraph EXTRACT[extractor.extract_text detail]
        EXT --> NATIVE[Native parse<br/>pypdf / python-docx]
        NATIVE --> VALID{Valid Unicode?<br/>detect legacy Nepali fonts<br/>Preeti/Kantipur...}
        VALID -->|yes| CLEAN[Normalize + cleanup]
        VALID -->|no / image| OCR[Tesseract OCR<br/>lang nep+eng, render pages]
        OCR --> CLEAN
    end

    subgraph STORE[store.index_document detail]
        IDX --> ENSURE[ensure_collection<br/>dense cosine + bm25 sparse]
        ENSURE --> SPARSE[Compute BM25 sparse vectors]
        SPARSE --> POINTS[Build PointStruct per chunk<br/>id=uuid5 doc_id:i<br/>payload: content, chunk_index, char range, metadata]
        POINTS --> UPSERT[(Qdrant upsert<br/>batches of 100)]
    end

    FIN -->|201: chunk_count, text_length,<br/>is_ocr, page_count| DONE
    DONE[DocumentsService updates row<br/>status=INDEXED, chunkCount,<br/>textLength, isOcr, indexedAt] 
    UPSERT -.-> QDRANT[(Qdrant<br/>collection: documents)]
```

### Progress polling (runs in parallel with ingestion)

```mermaid
sequenceDiagram
    participant Web
    participant API
    participant AI
    Web->>API: GET /documents/:id/progress (poll)
    API->>AI: GET /documents/:id/progress
    AI-->>API: {stage, percent} (extracting→chunking→embedding→indexing)
    API-->>Web: {stage, percent, status}
    Note over Web: Batch variant: GET /documents/progress/batch?ids=a,b,c
```

**Stages emitted** by `progress.update`: `extracting` → `chunking` → `embedding`
(per-chunk %) → `indexing` (per-batch %) → `done` (or `failed`).

---

## 2. Query (RAG) Pipeline

```mermaid
flowchart TD
    subgraph WEB2[apps/web]
        Q[User asks question] --> QP[POST query via api/rag]
    end

    subgraph API2[apps/api - NestJS]
        QP --> RAGCTRL[RagController → RagService]
        RAGCTRL -->|HTTP POST AI/query<br/>question, doc_id/doc_ids,<br/>top_k, language| RAGQ
    end

    subgraph AI2[apps/ai - rag.query]
        RAGQ[_query handler] --> SMALL{lexical small talk?<br/>hi/namaste/thanks...}
        SMALL -->|yes| CHAT[llm.generate_chat<br/>no retrieval]
        SMALL -->|no| QEMB[embeddings.get_embedding<br/>kind=query]
        QEMB --> INTENT{semantic intent?<br/>chat vs doc prototypes<br/>LLM tiebreak in margin}
        INTENT -->|chat| CHAT
        INTENT -->|document| SEARCH[store.search<br/>over-fetch top_k*3, max 20]
        SEARCH --> SELECT[_select_context<br/>drop score < 0.78 threshold<br/>dedup near-identical chunks]
        SELECT --> HAS{any results?}
        HAS -->|no| NORES[llm.generate_no_results]
        HAS -->|yes| GEN[llm.generate_answer<br/>Groq llama-3.3-70b + context chunks]
        GEN --> OUT[answer + sources<br/>doc_id, chunk_index, content,<br/>score, title]
    end

    subgraph SEARCHD[store.search detail - hybrid]
        SEARCH --> FILTER[Build filter<br/>doc_id / doc_ids scope]
        FILTER --> HYB{sparse available?}
        HYB -->|yes| RRF[Qdrant query_points<br/>dense prefetch + BM25 prefetch<br/>Fusion.RRF]
        HYB -->|no| DENSE[Dense-only cosine search]
        RRF --> RESCORE[Re-score by cosine on stored<br/>dense vector, sort desc]
        DENSE --> RESCORE
    end

    CHAT --> RET[Return to API → web]
    NORES --> RET
    OUT --> RET
    SEARCH -.reads.-> QDRANT2[(Qdrant)]
    GEN -.calls.-> GROQ[(Groq API)]
```

---

## Key Configuration (`apps/ai/app/config.py`)

| Setting | Default | Purpose |
|---|---|---|
| `EMBEDDING_MODEL` | `intfloat/multilingual-e5-base` | Dense embeddings (English + Nepali) |
| `EMBEDDING_DIM` | `768` | Must match Qdrant collection vector size |
| `HYBRID_SEARCH` | `true` | Dense + BM25 sparse fused via RRF |
| `SPARSE_MODEL` | `Qdrant/bm25` | Keyword/sparse retrieval |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `800` / `120` | Paragraph-aware chunking, word-boundary overlap |
| `RAG_SCORE_THRESHOLD` | `0.78` | Cosine cutoff for retained context |
| `QDRANT_COLLECTION` | `documents` | Vector collection |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Answer + chat generation |
| `TESSERACT_LANG` | `nep+eng` | OCR fallback for legacy Nepali fonts |

## Document Status Lifecycle (Prisma)

```
PENDING ──► PROCESSING ──► INDEXED
                 │
                 └──► FAILED
INDEXED ──(unembed)──► UNEMBEDDED ──(embed)──► PROCESSING ...
```

## Notable Design Points

- **Async ingestion**: the API returns the document row immediately; embedding
  happens in the background (`processDocument`) and the client polls progress.
- **CPU work off the event loop**: the AI service runs the OCR/embedding pipeline
  in a worker thread (`asyncio.to_thread`) so progress polls and queries stay responsive.
- **OCR fallback for legacy fonts**: native text is validated for real Unicode; if it
  looks like a legacy Nepali encoding (Preeti/Kantipur), pages are re-read via Tesseract.
- **Hybrid retrieval**: dense (semantic) + BM25 (keyword) prefetch fused with RRF,
  then re-scored by cosine so thresholds/UI relevance stay comparable.
- **Intent routing**: small talk is answered directly (no retrieval) via a lexical
  match, then an embedding-prototype check with an LLM tiebreak.
- **Deterministic point IDs**: `uuid5(doc_id:chunk_index)` makes re-indexing idempotent
  and per-document delete a simple `doc_id` filter.
