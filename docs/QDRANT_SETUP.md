# Qdrant Setup Guide

This guide walks through setting up [Qdrant](https://qdrant.tech/) — the vector
database used by `apps/ai` for document embeddings and RAG search — for local
development on this system.

## Why Qdrant here

`apps/ai/app/store.py` uses Qdrant to store chunk embeddings produced by the
`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` model
(384-dimension vectors, cosine distance) and to run similarity search for the
`/query` endpoint. The collection is created automatically by the app
(`ensure_collection()`) on first use — you only need Qdrant itself running and
reachable.

Relevant config (`apps/ai/app/config.py` / `apps/ai/.env`):

| Variable | Default | Purpose |
|---|---|---|
| `QDRANT_URL` | `http://localhost:6333` | Qdrant REST/gRPC endpoint |
| `QDRANT_COLLECTION` | `documents` | Collection name used for chunks |

## Option 1: Docker (recommended)

This matches the `qdrant-ai` container already visible in Docker Desktop on
this machine (image `qdrant/qdrant`, port `6333:6333`).

### 1. Pull and run the container

```bash
docker run -d \
  --name qdrant-ai \
  -p 6333:6333 \
  -p 6334:6334 \
  -v qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

- Port `6333` — HTTP/REST API (used by `qdrant-client` in this project)
- Port `6334` — gRPC API (optional, not required here)
- `-v qdrant_storage:/qdrant/storage` — named Docker volume so vector data
  survives container restarts/recreation

### 2. Verify it's running

```bash
docker ps --filter name=qdrant-ai
curl http://localhost:6333/healthz
```

You should get `healthz check passed`. The Qdrant dashboard is available at
[http://localhost:6333/dashboard](http://localhost:6333/dashboard).

### 3. Start/stop later

```bash
docker start qdrant-ai
docker stop qdrant-ai
```

## Option 2: docker-compose

If you'd rather manage it alongside other services, add this service block to
a `docker-compose.yml` at the repo root (create one if it doesn't exist):

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    container_name: qdrant-ai
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_storage:/qdrant/storage

volumes:
  qdrant_storage:
```

Then:

```bash
docker compose up -d qdrant
```

## Option 3: Native binary (no Docker)

Only use this if Docker isn't available on the machine.

```bash
# macOS (Homebrew)
brew install qdrant

# Run with local storage
qdrant --config-path ./qdrant_config.yaml
```

Storage defaults to `./storage` in the working directory when run this way.
Docker is preferred since it matches how the project already runs it.

## Configuring the AI service to use it

1. Copy the env example if you haven't already:
   ```bash
   cd apps/ai
   cp .env.example .env
   ```
2. Confirm `QDRANT_URL=http://localhost:6333` in `apps/ai/.env` (default is
   already correct for the Docker setup above).
3. Install Python deps and run the service:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   .venv/bin/python -m uvicorn app.main:app --reload --port 8000
   ```
4. Check the combined health endpoint:
   ```bash
   curl http://localhost:8000/health
   ```
   The response includes a `"qdrant": true/false` field driven by
   `store.is_connected()` — `true` confirms the AI service can reach Qdrant.

## Collection details (auto-created)

`store.ensure_collection()` creates the collection on first document upload
or query if it doesn't already exist:

- Name: value of `QDRANT_COLLECTION` (default `documents`)
- Vector size: `384` (must match the embedding model's output dimension)
- Distance metric: `Cosine`

If you ever change `EMBEDDING_MODEL` to one with a different output
dimension, delete the existing collection first (see below) so it can be
recreated with the correct vector size — Qdrant will not resize an existing
collection.

## Useful maintenance commands

```bash
# List collections
curl http://localhost:6333/collections

# Inspect the "documents" collection
curl http://localhost:6333/collections/documents

# Delete the collection (forces recreation on next upload)
curl -X DELETE http://localhost:6333/collections/documents

# Count points in the collection
curl -X POST http://localhost:6333/collections/documents/points/count \
  -H "Content-Type: application/json" \
  -d '{"exact": true}'
```

## Troubleshooting

- **`"qdrant": false` in `/health`** — container not running, wrong
  `QDRANT_URL`, or port `6333` blocked/in use by another process. Check with
  `docker ps` and `curl http://localhost:6333/healthz`.
- **Port 6333 already in use** — another Qdrant instance or process is bound
  to it. Either stop it or remap the container port (e.g. `-p 6343:6333` and
  update `QDRANT_URL` accordingly).
- **Vector dimension mismatch errors on upsert** — the embedding model was
  changed without recreating the collection. Delete the collection (above)
  and re-index documents.
- **Data lost after container recreation** — you ran `docker run` without a
  volume mount, or removed the volume with `docker volume rm`. Always mount
  `/qdrant/storage` to a named volume as shown above.
- **Container shows unhealthy/restarting in Docker Desktop** — check logs with
  `docker logs qdrant-ai`.

## Production considerations

- Use [Qdrant Cloud](https://cloud.qdrant.io/) or a persistent volume-backed
  deployment — don't rely on ephemeral container storage.
- Set `QDRANT_URL` to the production endpoint via `apps/ai/.env` (or your
  deployment's secret/env manager) — no code changes required.
- If the production Qdrant instance requires an API key, pass it when
  constructing the client in `app/store.py`
  (`QdrantClient(url=..., api_key=...)`) and add a `QDRANT_API_KEY` env var
  to `config.py`.
