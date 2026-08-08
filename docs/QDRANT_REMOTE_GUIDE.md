# Using the Remote Qdrant (`http://3.93.184.47:6333/`) with the RAG

This guide explains how to point the current RAG stack (`apps/ai`) at the
**remote Qdrant instance** running at `http://3.93.184.47:6333/`, verify the
connection, and then work with its collections.

It is a companion to [`QDRANT_SETUP.md`](./QDRANT_SETUP.md) (local Docker setup)
and [`RAG_IMPLEMENTATION.md`](./RAG_IMPLEMENTATION.md). Nothing here changes code
— it only tells you which env values to set and which requests to make.

---

## 1. What this remote instance is

A quick probe of the endpoint:

```bash
curl http://3.93.184.47:6333/
```

```json
{"title":"qdrant - vector search engine","version":"1.18.2","commit":"..."}
```

- **Version:** Qdrant `1.18.2`
- **HTTP/REST port:** `6333` (this is what `qdrant-client` in `apps/ai` uses)
- **gRPC port:** `6334` (optional, not used by this project)
- **Dashboard:** <http://3.93.184.47:6333/dashboard>

> ⚠️ **Security note:** `3.93.184.47` is a public IP. If this Qdrant has no API
> key, anyone who can reach the port can read/write/delete every collection.
> Treat it as a shared dev instance — don't store anything sensitive, and
> prefer securing it with `QDRANT__SERVICE__API_KEY` (see §7).

---

## 2. How the RAG talks to Qdrant

The AI service reads three variables from `apps/ai/.env`
(defined in `apps/ai/app/config.py`) and hands them to the Qdrant client in
`apps/ai/app/store.py`:

| Variable | Purpose | Value for the remote |
|---|---|---|
| `QDRANT_URL` | REST endpoint the client connects to | `http://3.93.184.47:6333` |
| `QDRANT_API_KEY` | API key, if the instance requires one | the remote's key, or **empty** if unsecured |
| `QDRANT_COLLECTION` | Collection name used for chunks | `documents` (default) or your own |
| `EMBEDDING_DIM` | Dense vector size — **must** match the collection | `768` (for `intfloat/multilingual-e5-base`) |
| `HYBRID_SEARCH` | Adds a BM25 sparse vector alongside dense | `true` (default) |

The client is constructed here:

```python
# apps/ai/app/store.py
_client = QdrantClient(
    url=config.QDRANT_URL,
    api_key=config.QDRANT_API_KEY or None,
)
```

So **switching to the remote is purely an `.env` change** — no code edits.

---

## 3. Point the RAG at the remote

Edit `apps/ai/.env` (not committed) and set:

```dotenv
QDRANT_URL=http://3.93.184.47:6333

# If the remote instance is unsecured, leave this EMPTY.
# If it was started with QDRANT__SERVICE__API_KEY=<key>, put that same raw key here.
QDRANT_API_KEY=

# Keep the collection name and dimension consistent with your embedding model.
QDRANT_COLLECTION=documents
EMBEDDING_DIM=768
```

> **Important — API key must match:** The local `.env.example` and any existing
> local `.env` may carry a placeholder like `QDRANT_API_KEY=mysecretpass` that
> belongs to a *local* container. That value is almost certainly **wrong for the
> remote**. Use the remote's real key, or leave it empty if the remote has none.
> A wrong/extra key on an unsecured server, or a missing key on a secured one,
> both surface as `401`/connection failures in step 4.

Then (re)start the AI service so it re-reads `.env`:

```bash
cd apps/ai
source .venv/bin/activate
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

`config.py` loads `.env` with `override=True`, so the file wins even across
uvicorn reloads.

---

## 4. Verify the connection

**A. Directly against Qdrant** (does not involve the AI service):

```bash
# Liveness
curl http://3.93.184.47:6333/healthz          # -> "healthz check passed"

# List collections
curl http://3.93.184.47:6333/collections
```

If the instance requires a key, add it as a header:

```bash
curl -H "api-key: <YOUR_KEY>" http://3.93.184.47:6333/collections
```

**B. Through the AI service** — this is the real end-to-end check, because it
uses your `.env` values and `store.is_connected()`:

```bash
curl http://localhost:8000/health
```

Look for `"qdrant": true` in the response. `true` means the AI service
successfully reached the remote with the URL + key you configured. `false`
means unreachable, wrong URL, or an auth mismatch — see §8.

---

## 5. How the collection gets created

You normally **don't** create the collection by hand. On the first document
upload or query, `store.ensure_collection()` creates it to match the current
config:

- **Name:** value of `QDRANT_COLLECTION` (default `documents`)
- **Dense vector:** named `dense`, size `EMBEDDING_DIM` (768), `Cosine` distance
- **Sparse vector:** named `bm25` with IDF modifier — only when `HYBRID_SEARCH=true`
- **Payload index:** a `keyword` index on `doc_id` for fast per-document filtering

`ensure_collection()` also **self-heals**: if a collection with that name exists
but has the wrong dense dimension, an unnamed/legacy vector schema, or is missing
the `bm25` sparse vector while hybrid is on, it **deletes and recreates** it —
which means previously indexed documents must be re-uploaded. Keep
`EMBEDDING_DIM` / `EMBEDDING_MODEL` / `HYBRID_SEARCH` stable per collection to
avoid surprise rebuilds.

The remote currently reports **no collections** (`"collections":[]`), so the
first upload/query will create a fresh one.

---

## 6. Working with collections

### 6.1 Trigger creation + first index (via the AI service)

Upload a document through the AI service so the normal pipeline
(extract → chunk → embed → upsert) runs and creates the collection:

```bash
curl -X POST http://localhost:8000/documents \
  -F "file=@/path/to/notice.pdf"
```

Then confirm it landed in the remote:

```bash
curl http://3.93.184.47:6333/collections
curl http://3.93.184.47:6333/collections/documents
```

> Prefer creating collections through the app (upload/query) rather than by hand,
> so the schema always matches what `store.py` expects (`dense` + `bm25` named
> vectors, `doc_id` keyword index). A manually-made collection with a mismatched
> schema will just get recreated by `ensure_collection()`.

### 6.2 Inspect a collection

```bash
# Full config: vectors, sparse vectors, points count, status
curl http://3.93.184.47:6333/collections/documents

# Exact point count
curl -X POST http://3.93.184.47:6333/collections/documents/points/count \
  -H "Content-Type: application/json" \
  -d '{"exact": true}'
```

### 6.3 Browse points / payloads

```bash
# Scroll the first few points (with payload, without vectors)
curl -X POST http://3.93.184.47:6333/collections/documents/points/scroll \
  -H "Content-Type: application/json" \
  -d '{"limit": 5, "with_payload": true, "with_vector": false}'
```

Each point's payload carries `doc_id`, `chunk_index`, `content`, `char_start`,
`char_end`, plus any document metadata (see `index_document()` in `store.py`).

### 6.4 Filter by a document

```bash
curl -X POST http://3.93.184.47:6333/collections/documents/points/scroll \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 100,
    "with_payload": true,
    "filter": { "must": [ { "key": "doc_id", "match": { "value": "<DOC_ID>" } } ] }
  }'
```

This mirrors what the app does for per-document search and deletion. Deleting a
document through the AI service (`delete_document()`) removes every point whose
`doc_id` matches.

### 6.5 Create a second/separate collection

To keep datasets isolated (e.g. one per environment or per model), just change
the name and re-index — the app creates it on demand:

```dotenv
# apps/ai/.env
QDRANT_COLLECTION=notices_v2
```

Restart the service, upload a document, and `notices_v2` appears alongside
`documents`. Switching `QDRANT_COLLECTION` back and forth lets you point the RAG
at different collections without touching data in the others.

### 6.6 Reset / delete a collection

```bash
# Delete (forces a clean recreation on the next upload/query)
curl -X DELETE http://3.93.184.47:6333/collections/documents
```

Use this when you want to wipe all indexed chunks, or after changing the
embedding model/dimension (Qdrant cannot resize an existing collection's
vectors).

### 6.7 Multiple developers sharing this remote

Because everyone pointing `QDRANT_URL` at `3.93.184.47` shares the same server:

- **Namespace by collection** — give each person/environment its own
  `QDRANT_COLLECTION` (e.g. `documents_ashok`, `documents_ci`) so uploads and
  deletes don't collide.
- A `DELETE /collections/<name>` or an `EMBEDDING_DIM` change by one person
  affects everyone using that same collection. Coordinate before recreating.

---

## 7. Securing the remote (recommended)

If you control the server, run Qdrant with an API key and share it out of band:

```bash
docker run -d --name qdrant \
  -p 6333:6333 -p 6334:6334 \
  -e QDRANT__SERVICE__API_KEY=<STRONG_KEY> \
  -v qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

Then every client — including this RAG — must send that key. Set it in
`apps/ai/.env`:

```dotenv
QDRANT_API_KEY=<STRONG_KEY>
```

The client picks it up automatically (`api_key=config.QDRANT_API_KEY or None`).
Plain API keys and JWT tokens differ: a JWT is only accepted if the container
also runs with `QDRANT__SERVICE__JWT_RBAC=true`; otherwise use the raw key.

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `"qdrant": false` in `/health` | Remote unreachable, wrong `QDRANT_URL`, or firewall/security group blocking `6333` | `curl http://3.93.184.47:6333/healthz`; confirm the AWS security group allows your IP on `6333` |
| `401 Unauthorized` from Qdrant | Remote requires a key you didn't send, or you sent a stale/wrong one (e.g. leftover `mysecretpass`) | Set the correct `QDRANT_API_KEY`, or empty it if the remote is unsecured |
| Dimension mismatch on upsert | Collection built for a different `EMBEDDING_DIM`/model | `DELETE` the collection and re-index, keeping `EMBEDDING_DIM=768` for `multilingual-e5-base` |
| Collection got recreated unexpectedly | `ensure_collection()` found a schema mismatch (dim, unnamed vectors, or missing `bm25` while `HYBRID_SEARCH=true`) | Keep `EMBEDDING_MODEL`/`EMBEDDING_DIM`/`HYBRID_SEARCH` stable per collection; re-upload docs |
| Search returns nothing / low relevance | Empty collection, or `RAG_SCORE_THRESHOLD` too high | Confirm point count (§6.2); note E5 scores sit ~0.7–0.9, threshold defaults to `0.78` |
| Slow first request | Embedding model download/load on cold start | Expected once per process; subsequent requests are fast |
| Someone else's data appears / your data vanished | Sharing one collection on the shared remote | Namespace by `QDRANT_COLLECTION` (§6.7) |

---

## 9. Quick reference

```bash
# --- Direct to remote Qdrant ---
curl http://3.93.184.47:6333/                       # version/info
curl http://3.93.184.47:6333/healthz                # liveness
curl http://3.93.184.47:6333/collections            # list collections
curl http://3.93.184.47:6333/collections/documents  # inspect one
curl -X DELETE http://3.93.184.47:6333/collections/documents  # reset

# --- Through the AI service (uses apps/ai/.env) ---
curl http://localhost:8000/health                   # look for "qdrant": true
curl -X POST http://localhost:8000/documents -F "file=@notice.pdf"  # index
```

`apps/ai/.env` values that matter for the remote:

```dotenv
QDRANT_URL=http://3.93.184.47:6333
QDRANT_API_KEY=            # remote's key, or empty if unsecured
QDRANT_COLLECTION=documents
EMBEDDING_DIM=768
HYBRID_SEARCH=true
```
