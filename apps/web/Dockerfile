# ---------- Base ----------
FROM node:22-alpine AS base

WORKDIR /app


# ---------- Dependencies ----------
FROM base AS deps

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json

RUN pnpm install --frozen-lockfile


# ---------- Builder ----------
FROM base AS builder

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

COPY . .

WORKDIR /app/apps/web

RUN pnpm build


# ---------- Production ----------
FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3535
ENV HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3535

CMD ["node", "apps/web/server.js"]