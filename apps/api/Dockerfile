# ---------- Base ----------
FROM node:22-alpine AS base

WORKDIR /app

# ---------- Dependencies ----------
FROM base AS deps

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma

RUN pnpm install --frozen-lockfile

# ---------- Builder ----------
FROM base AS builder

RUN corepack enable

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/apps/api/prisma ./apps/api/prisma

COPY . .

WORKDIR /app/apps/api

RUN pnpm prisma:generate
RUN pnpm build

# ---------- Production ----------
FROM node:22-alpine AS runner

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "dist/main.js"]