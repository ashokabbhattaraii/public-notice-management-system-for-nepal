# Deploying to Oracle Cloud (Always Free tier)

This is a copy-paste guide to get `web` + `api` + `ai` (plus Postgres and Qdrant)
running on a single Oracle Cloud "Always Free" instance, fronted by Caddy for
automatic HTTPS. WhatsApp (Evolution API) integration is intentionally skipped
for this first pass — leave `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` unset.

## Why this shape

Oracle's free tier has two compute options:
- `VM.Standard.E2.1.Micro` (AMD) — 1 OCPU / 1GB RAM each, x2. Too small: the
  `apps/ai` embedding model + Playwright/crawl4ai (used in `apps/ai/app/scraper.py`)
  need more headroom than 1GB.
- **`VM.Standard.A1.Flex` (Ampere/Arm) — up to 4 OCPUs / 24GB RAM, free forever.**
  This is the one to use. One instance runs everything via Docker Compose.

Postgres and Qdrant run as containers on the same box rather than using
Oracle's free Autonomous DB, because Autonomous DB is a proprietary Oracle
engine that Prisma (used in `apps/api`) doesn't target.

## 1. Create the instance

OCI Console → Compute → Instances → **Create Instance**
- Shape: `VM.Standard.A1.Flex`, 4 OCPU / 24GB (the max Always Free allotment)
- Image: Ubuntu 22.04 (aarch64/Arm build)
- Attach or generate an SSH key pair, download the private key
- Note the instance's public IP

## 2. Networking

In the instance's VCN → Security List (or a dedicated NSG), add ingress rules:
- TCP 80 (HTTP, for Let's Encrypt challenge + redirect)
- TCP 443 (HTTPS)
- TCP 22 (SSH) — ideally restrict the source CIDR to your own IP

## 3. DNS

Point these A records at the instance's public IP:
- `example.com` → web
- `api.example.com` → api
- `ai.example.com` → ai

(swap `example.com` for your real domain everywhere below)

## 4. Provision the box

```bash
ssh -i /path/to/key.pem ubuntu@<public-ip>

# Docker Engine + compose plugin (has arm64 builds)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
sudo apt-get update && sudo apt-get install -y docker-compose-plugin git
```

## 5. Get the code onto the box

```bash
git clone <your-repo-url> public-notice-management
cd public-notice-management
```

## 6. Dockerfiles

None of these exist in the repo yet — create them on the box (or commit them
to the repo later once you're happy with the setup).

### `apps/web/Dockerfile`

First add to `apps/web/next.config.mjs`:
```js
const nextConfig = {
  output: 'standalone',
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
}
```

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile --filter @pnm/web...

FROM deps AS build
COPY apps/web apps/web
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AI_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_AI_URL=$NEXT_PUBLIC_AI_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
RUN pnpm --filter @pnm/web build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=build /repo/apps/web/public ./public
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./.next/static
EXPOSE 3535
ENV PORT=3535
CMD ["node", "apps/web/server.js"]
```
(`.next/standalone` preserves the monorepo path, so the entrypoint is
`apps/web/server.js` relative to the copied root — verify this path after your
first build and adjust if Next lays it out differently.)

### `apps/api/Dockerfile`

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma apps/api/prisma
RUN pnpm install --frozen-lockfile --filter @pnm/api...

FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter @pnm/api build

FROM node:20-alpine AS runner
RUN corepack enable
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/apps/api ./apps/api
WORKDIR /repo/apps/api
EXPOSE 5005
CMD ["sh", "-c", "pnpm prisma migrate deploy && node dist/main"]
```

### `apps/ai/Dockerfile`

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr tesseract-ocr-nep poppler-utils \
    curl gnupg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/ai/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install --with-deps chromium

COPY apps/ai .

EXPOSE 8000
CMD ["python3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
(`tesseract-ocr-nep` may not exist on `bookworm`'s default apt repos — if the
install fails, drop it and instead download `nep.traineddata` from
[tesseract-ocr/tessdata](https://github.com/tesseract-ocr/tessdata) into
`/usr/share/tesseract-ocr/5/tessdata/`.)

## 7. `docker-compose.yml` (repo root)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: public_notice_management
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

  qdrant:
    image: qdrant/qdrant:latest
    restart: unless-stopped
    volumes:
      - qdrant_data:/qdrant/storage

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    restart: unless-stopped
    env_file: apps/api/.env.prod
    depends_on:
      postgres:
        condition: service_healthy

  ai:
    build:
      context: .
      dockerfile: apps/ai/Dockerfile
    restart: unless-stopped
    env_file: apps/ai/.env.prod
    depends_on:
      - qdrant
    volumes:
      - ai_uploads:/app/data/uploads

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        NEXT_PUBLIC_APP_URL: https://example.com
        NEXT_PUBLIC_API_URL: https://api.example.com
        NEXT_PUBLIC_AI_URL: https://ai.example.com
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
    restart: unless-stopped
    depends_on:
      - api

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - web
      - api
      - ai

volumes:
  postgres_data:
  qdrant_data:
  ai_uploads:
  caddy_data:
  caddy_config:
```

## 8. `Caddyfile` (repo root)

```
example.com {
    reverse_proxy web:3535
}

api.example.com {
    reverse_proxy api:5005
}

ai.example.com {
    reverse_proxy ai:8000
}
```

Caddy fetches Let's Encrypt certs automatically once DNS resolves to the box.

## 9. Secrets — create these on the box, never commit them

`apps/api/.env.prod` (start from `apps/api/.env.example`, then set):
```
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@postgres:5432/public_notice_management
JWT_SECRET=<random 32+ char secret>
GOOGLE_CLIENT_ID=<your Google OAuth client id>
WEB_ORIGIN=https://example.com
AI_SERVICE_URL=http://ai:8000
```

`apps/ai/.env.prod` (start from `apps/ai/.env.example`, then set):
```
QDRANT_URL=http://qdrant:6333
GROQ_API_KEY=<your key>
GEMINI_API_KEY=<your key>
CORS_ORIGINS=https://example.com
```

Root shell env for the compose build (or put in a root `.env` that
`docker compose` auto-loads):
```
POSTGRES_PASSWORD=<strong password>
GOOGLE_CLIENT_ID=<same value as apps/api/.env.prod>
```

## 10. Launch

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f
```

## 11. Verify

```bash
curl -I https://example.com
curl -I https://api.example.com/api/docs
curl -I https://ai.example.com/health
docker compose exec api pnpm prisma migrate status
```

Then upload a test PDF through the UI and run a RAG query to confirm
Postgres, Qdrant, tesseract OCR, and the embedding model all work end-to-end
inside the containers.
