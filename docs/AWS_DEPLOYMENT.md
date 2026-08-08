# AWS Deployment Guide

> AI-Powered Cloud-Based Public Notice Management System for Nepal
> Author: Ashok Bhattarai (NP069811)
> Companion to `docs/TechStackByModule.md` and `docs/DOCUMENT_SECTION_GUIDE.md`.

This guide provides a **step-by-step, production-ready deployment** of the
entire platform on AWS, matching the report's Phase 7 (Testing and Cloud
Deployment) architecture: **EC2 for API + AI, RDS PostgreSQL, S3, Qdrant Cloud,
and Vercel for the frontend.**

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [Target architecture](#3-target-architecture)
4. [RDS PostgreSQL setup](#4-rds-postgresql-setup)
5. [S3 bucket for document storage](#5-s3-bucket-for-document-storage)
6. [EC2 / ECS deployment — NestJS API](#6-ec2--ecs-deployment--nestjs-api)
7. [EC2 / ECS deployment — Python AI service](#7-ec2--ecs-deployment--python-ai-service)
8. [Qdrant vector store](#8-qdrant-vector-store)
9. [Vercel — Next.js frontend](#9-vercel--nextjs-frontend)
10. [CI/CD pipeline](#10-cicd-pipeline)
11. [Environment variables reference](#11-environment-variables-reference)
12. [DNS, SSL & HTTPS](#12-dns-ssl--https)
13. [Monitoring & observability](#13-monitoring--observability)
14. [Cost estimate](#14-cost-estimate)
15. [Deployment checklist](#15-deployment-checklist)

---

## 1. Overview

The system consists of four deployed components:

| Component | Where | Why |
|-----------|-------|-----|
| Next.js frontend (`apps/web`) | **Vercel** | Global CDN, zero-config Next.js hosting, free tier |
| NestJS API (`apps/api`) | **AWS EC2** (or ECS Fargate) | Gateway, auth, business logic, DB access |
| Python AI service (`apps/ai`) | **AWS EC2** (or ECS Fargate) | Heavy AI workloads (OCR, embeddings, Qdrant writes) |
| PostgreSQL | **AWS RDS** | Managed relational DB, automated backups |
| Document files | **AWS S3** | Scalable, durable object storage |
| Vector store | **Qdrant Cloud** (or self-host on EC2) | Free managed 1 GB cluster |

All backend components sit in a **private subnet** behind an Application Load
Balancer (ALB). Only the ALB and Vercel-hosted frontend are internet-facing.

---

## 2. Prerequisites

Before you start:

- [ ] AWS account with billing enabled.
- [ ] AWS CLI v2 installed and configured (`aws configure`).
- [ ] Domain name registered (e.g. `pnm.ashokbhattarai.com.np`).
- [ ] GitHub/GitLab repository containing this monorepo.
- [ ] Node.js 22+, pnpm 10+, Python 3.11+ locally for building.
- [ ] Docker installed (for building container images).
- [ ] Vercel account (free tier is sufficient).
- [ ] Qdrant Cloud account (free 1 GB cluster) — https://cloud.qdrant.io

**AWS services used:**

| Service | Purpose | Free-tier eligible? |
|---------|---------|:---:|
| EC2 (`t3.medium`) | API + AI hosts | 750 hrs/mo `t2.micro` only |
| RDS (`db.t3.micro`) | PostgreSQL | ✅ 750 hrs/mo first year |
| S3 | Document uploads | ✅ 5 GB |
| ALB | HTTPS load balancer | No (≈$16/mo base) |
| ACM | Free SSL certificates | ✅ |
| VPC | Networking | ✅ |
| ECR | Container registry | ✅ 500 MB |
| CloudWatch | Logs + metrics | ✅ basic |
| Route 53 | DNS (optional) | $0.50/zone/mo |

---

## 3. Target architecture

```
                        ┌───────────────────────────────────┐
                        │            Internet                │
                        └───────────┬───────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────────┐
              │                     │                          │
              ▼                     ▼                          ▼
    ┌──────────────────┐  ┌──────────────────────┐  ┌────────────────────┐
    │  Vercel (CDN)    │  │  AWS ALB (HTTPS)     │  │  Qdrant Cloud      │
    │  Next.js web     │  │  api.pnm.example.com │  │  (managed, free)   │
    │  pnm.example.com │  └───────┬──────────────┘  └────────┬───────────┘
    └──────────────────┘          │                           │
                                  │ Private subnet            │ HTTPS
                    ┌─────────────┴──────────────┐            │
                    │                            │            │
              ┌─────┴──────┐          ┌──────────┴───┐        │
              │ EC2 / ECS  │          │ EC2 / ECS    │        │
              │ NestJS API │──REST──▶│ Python AI    │────────┘
              │ :3001      │         │ :8000         │
              └─────┬──────┘         └──────────────┘
                    │
          ┌─────────┴──────────┐
          │                    │
    ┌─────┴──────┐      ┌─────┴──────┐
    │ RDS        │      │ S3 Bucket  │
    │ PostgreSQL │      │ documents  │
    └────────────┘      └────────────┘
```

**Security design:**
- RDS + EC2 in **private subnets** (no public IP).
- ALB in **public subnets** terminates HTTPS via ACM certificate.
- EC2 instances reach the internet through a **NAT Gateway** (for pip/npm
  installs during build, Qdrant Cloud access).
- S3 bucket is **private** — the API accesses it via IAM role, never presigned
  URLs exposed publicly.
- Vercel calls the ALB over HTTPS with the domain + CORS allowlist.

---

## 4. RDS PostgreSQL setup

### 4.1 Create the database

```bash
aws rds create-db-instance \
  --db-instance-identifier pnm-postgres \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 16.4 \
  --master-username pnm_admin \
  --master-user-password '<STRONG_PASSWORD>' \
  --allocated-storage 20 \
  --storage-type gp3 \
  --vpc-security-group-ids sg-xxxxxxxx \
  --db-subnet-group-name pnm-db-subnet-group \
  --no-publicly-accessible \
  --backup-retention-period 7 \
  --multi-az false \
  --storage-encrypted \
  --tags Key=Project,Value=PNM
```

> **Free-tier note:** `db.t3.micro` + 20 GB gp3 is free-tier eligible for
> 12 months.

### 4.2 Create the application database

SSH into a bastion or use the EC2 instance later:

```bash
psql -h pnm-postgres.xxxx.ap-south-1.rds.amazonaws.com -U pnm_admin -d postgres
```

```sql
CREATE DATABASE govnotice;
```

### 4.3 Run Prisma migrations

From your CI/CD pipeline or manually the first time:

```bash
cd apps/api
DATABASE_URL="postgresql://pnm_admin:<PASSWORD>@<RDS_ENDPOINT>:5432/govnotice?sslmode=require" \
  npx prisma migrate deploy
```

This applies all migrations in `prisma/migrations/` without generating new ones.

### 4.4 Security group rules for RDS

| Source | Port | Protocol | Description |
|--------|------|----------|-------------|
| `sg-api` (API EC2) | 5432 | TCP | Allow API to connect |
| `sg-ai` (AI EC2) | — | — | AI does NOT need direct DB access |

Keep the RDS SG locked down: only the API security group can reach port 5432.

---

## 5. S3 bucket for document storage

### 5.1 Create the bucket

```bash
aws s3api create-bucket \
  --bucket pnm-documents-prod \
  --region ap-south-1 \
  --create-bucket-configuration LocationConstraint=ap-south-1

# Block ALL public access (mandatory).
aws s3api put-public-access-block \
  --bucket pnm-documents-prod \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Enable server-side encryption (SSE-S3).
aws s3api put-bucket-encryption \
  --bucket pnm-documents-prod \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'
```

### 5.2 IAM policy for the API

Create an IAM policy the API's EC2 instance role will use:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::pnm-documents-prod/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::pnm-documents-prod"
    }
  ]
}
```

Attach this policy to the **EC2 instance profile** (IAM role). Do NOT put
`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in environment variables — the SDK
auto-discovers the instance role credentials.

### 5.3 API environment

Set in the API's `.env` (or Secrets Manager / Parameter Store):

```bash
STORAGE_DRIVER=s3
S3_BUCKET=pnm-documents-prod
S3_REGION=ap-south-1
# No access keys needed — instance role is used.
```

---

## 6. EC2 / ECS deployment — NestJS API

You have two paths. This guide shows **EC2 with Docker** (simpler, cheaper) and
notes the **ECS Fargate** alternative.

### 6.1 Dockerfile (`apps/api/Dockerfile`)

```dockerfile
FROM node:22-slim AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/ packages/
RUN corepack enable && pnpm install --frozen-lockfile
COPY apps/api/ apps/api/
RUN pnpm --filter @pnm/api run build

FROM node:22-slim AS runtime
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/node_modules ./node_modules
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/package.json ./
# Generate Prisma client at runtime layer.
RUN npx prisma generate
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/main.js"]
```

### 6.2 Build and push to ECR

```bash
# Create repository (once).
aws ecr create-repository --repository-name pnm-api --region ap-south-1

# Login to ECR.
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

# Build and push.
docker build -f apps/api/Dockerfile -t pnm-api:latest .
docker tag pnm-api:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/pnm-api:latest
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/pnm-api:latest
```

### 6.3 EC2 setup

1. Launch a `t3.medium` instance (2 vCPU, 4 GB RAM) in the **private subnet**.
2. Attach the IAM instance profile with the S3 policy from §5.2.
3. Security group `sg-api`:
   - Inbound: port **3001** from ALB security group only.
   - Outbound: all (for RDS, Qdrant Cloud, ECR pulls).
4. Install Docker:

```bash
sudo yum update -y && sudo yum install -y docker
sudo systemctl enable docker && sudo systemctl start docker
sudo usermod -aG docker ec2-user
```

5. Pull and run:

```bash
# Login to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com

docker pull <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/pnm-api:latest

docker run -d --name pnm-api \
  --restart unless-stopped \
  -p 3001:3001 \
  --env-file /home/ec2-user/.env.api \
  <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/pnm-api:latest
```

### 6.4 ALB target group

```bash
# Create target group.
aws elbv2 create-target-group \
  --name pnm-api-tg \
  --protocol HTTP \
  --port 3001 \
  --vpc-id vpc-xxxxxxxx \
  --target-type instance \
  --health-check-path /auth/admin/ping \
  --health-check-interval-seconds 30

# Register the API EC2 instance.
aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:... \
  --targets Id=i-xxxxxxxx,Port=3001
```

Then add an HTTPS listener rule on the ALB forwarding
`api.pnm.example.com` to this target group.

### 6.5 ECS Fargate alternative (brief)

If you prefer serverless containers:

1. Create an ECS Cluster (Fargate).
2. Create a Task Definition using the ECR image, 0.5 vCPU / 1 GB memory.
3. Create a Service pointing to the ALB target group.
4. Pass secrets via **AWS Secrets Manager** referenced in the task definition.

ECS is more operable (auto-restarts, rolling deploys) but costs slightly more
than a single EC2 instance for this scale.

---

## 7. EC2 / ECS deployment — Python AI service

The AI service is CPU/memory-intensive (OCR + embedding inference). It runs on
its own instance so it doesn't starve the API.

### 7.1 Dockerfile (`apps/ai/Dockerfile`)

```dockerfile
FROM python:3.11-slim

# System deps for Tesseract OCR + PDF rendering.
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-nep \
    poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY apps/ai/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ai/app/ ./app/

EXPOSE 8000
ENV ENVIRONMENT=production
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

> **Why `--workers 2`?** Each worker loads the embedding model into RAM
> (~500 MB for MiniLM). On a `t3.medium` (4 GB) two workers is safe. Scale
> up if you use a larger instance.

### 7.2 Build and push

```bash
aws ecr create-repository --repository-name pnm-ai --region ap-south-1

docker build -f apps/ai/Dockerfile -t pnm-ai:latest .
docker tag pnm-ai:latest <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/pnm-ai:latest
docker push <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/pnm-ai:latest
```

### 7.3 EC2 setup

1. Launch a `t3.medium` (or `t3.large` for heavier OCR load) in the private subnet.
2. Security group `sg-ai`:
   - Inbound: port **8000** from `sg-api` only (the API calls the AI service).
   - Outbound: HTTPS (443) for Qdrant Cloud + ECR pulls.
3. Run:

```bash
docker run -d --name pnm-ai \
  --restart unless-stopped \
  -p 8000:8000 \
  --env-file /home/ec2-user/.env.ai \
  <ACCOUNT_ID>.dkr.ecr.ap-south-1.amazonaws.com/pnm-ai:latest
```

### 7.4 Health check

The API's `AiClient` calls `http://<AI_PRIVATE_IP>:8000`. Set:

```bash
# In the API's .env
AI_SERVICE_URL=http://10.0.x.x:8000
```

Or if using ECS, use **service discovery** (Cloud Map) for a DNS name like
`ai.pnm.local`.

### 7.5 Model download on first boot

`sentence-transformers` downloads the model from Hugging Face on first load.
Options:
- **Bake it into the Docker image** (recommended for prod):
  ```dockerfile
  RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"
  ```
- Or let it download at container start (requires outbound internet).

---

## 8. Qdrant vector store

### 8.1 Option A: Qdrant Cloud (recommended)

1. Sign up at https://cloud.qdrant.io — create a **free 1 GB cluster** in
   `aws/ap-south-1` (closest region to Nepal).
2. Note the cluster URL and API key.
3. Set in the AI service `.env`:

```bash
QDRANT_URL=https://xxxx-xxxx.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=<your-api-key>
QDRANT_COLLECTION=notices
EMBEDDING_DIM=384
```

**Advantages:** zero ops, automatic backups, 1 GB free (thousands of documents
worth of 384-dim vectors), low latency in the same AWS region.

### 8.2 Option B: Self-host on EC2

If you need more than 1 GB or want full control:

```bash
# On a dedicated t3.small (2 GB RAM is enough for this scale).
docker run -d --name qdrant \
  --restart unless-stopped \
  -p 6333:6333 -p 6334:6334 \
  -v /data/qdrant:/qdrant/storage \
  qdrant/qdrant

# Security group: inbound 6333 from sg-ai only.
```

Set `QDRANT_URL=http://<QDRANT_PRIVATE_IP>:6333` and leave `QDRANT_API_KEY`
empty.

### 8.3 Collection auto-creation

The AI service's `store.py` creates the `notices` collection on first request
(idempotent). No manual setup needed beyond network reachability.

### 8.4 Backup (self-host)

Qdrant supports snapshots:

```bash
# Create snapshot via HTTP API.
curl -X POST http://localhost:6333/collections/notices/snapshots
# Download and store in S3 periodically via a cron.
```

On Qdrant Cloud, backups are automatic.

---

## 9. Vercel — Next.js frontend

### 9.1 Connect repository

1. Go to https://vercel.com → **New Project** → import from GitHub.
2. Set the **Root Directory** to `apps/web`.
3. Framework preset: **Next.js** (auto-detected).
4. Build command: leave default (`next build`).
5. Output directory: leave default (`.next`).

### 9.2 Environment variables

In Vercel project settings → Environment Variables:

| Variable | Value | Scope |
|----------|-------|-------|
| `NEXT_PUBLIC_API_URL` | `https://api.pnm.example.com` | Production |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | `<your-client-id>.apps.googleusercontent.com` | All |

> The `NEXT_PUBLIC_` prefix exposes these to the client bundle; they contain
> no secrets.

### 9.3 Custom domain

In Vercel → Domains → add `pnm.example.com`. Point a CNAME from your DNS
provider to `cname.vercel-dns.com`. SSL is auto-provisioned.

### 9.4 Monorepo settings

Vercel needs to know this is a monorepo. In **Settings → General**:
- Build & Development Settings → Root Directory: `apps/web`
- Install Command: `pnpm install`

Or add a `vercel.json` at the repo root:

```json
{
  "buildCommand": "pnpm turbo run build --filter=@pnm/web",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": "apps/web/.next"
}
```

---

## 10. CI/CD pipeline

A **GitHub Actions** workflow that builds, tests, and deploys on push to `main`.

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  AWS_REGION: ap-south-1
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.ap-south-1.amazonaws.com

jobs:
  # ──────────────── Lint + Test ────────────────
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm build

  # ──────────────── Deploy API ────────────────
  deploy-api:
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      - uses: aws-actions/amazon-ecr-login@v2
      - name: Build & push API image
        run: |
          docker build -f apps/api/Dockerfile -t $ECR_REGISTRY/pnm-api:${{ github.sha }} .
          docker push $ECR_REGISTRY/pnm-api:${{ github.sha }}
      - name: Deploy to EC2 via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.API_EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin ${{ env.ECR_REGISTRY }}
            docker pull ${{ env.ECR_REGISTRY }}/pnm-api:${{ github.sha }}
            docker stop pnm-api || true && docker rm pnm-api || true
            docker run -d --name pnm-api --restart unless-stopped \
              -p 3001:3001 --env-file ~/.env.api \
              ${{ env.ECR_REGISTRY }}/pnm-api:${{ github.sha }}

  # ──────────────── Deploy AI ────────────────
  deploy-ai:
    needs: check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      - uses: aws-actions/amazon-ecr-login@v2
      - name: Build & push AI image
        run: |
          docker build -f apps/ai/Dockerfile -t $ECR_REGISTRY/pnm-ai:${{ github.sha }} .
          docker push $ECR_REGISTRY/pnm-ai:${{ github.sha }}
      - name: Deploy to EC2 via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.AI_EC2_HOST }}
          username: ec2-user
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin ${{ env.ECR_REGISTRY }}
            docker pull ${{ env.ECR_REGISTRY }}/pnm-ai:${{ github.sha }}
            docker stop pnm-ai || true && docker rm pnm-ai || true
            docker run -d --name pnm-ai --restart unless-stopped \
              -p 8000:8000 --env-file ~/.env.ai \
              ${{ env.ECR_REGISTRY }}/pnm-ai:${{ github.sha }}

  # ──────────────── Deploy Web (Vercel) ────────────────
  # Vercel auto-deploys on push to main via its GitHub integration.
  # No explicit job needed unless you want a manual trigger.
```

### 10.1 Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `AWS_ACCOUNT_ID` | 12-digit AWS account ID |
| `AWS_ACCESS_KEY_ID` | CI deploy user key |
| `AWS_SECRET_ACCESS_KEY` | CI deploy user secret |
| `API_EC2_HOST` | Private IP or bastion-reachable IP of the API instance |
| `AI_EC2_HOST` | Private IP of the AI instance |
| `EC2_SSH_KEY` | PEM key for `ec2-user` |

> **Best practice:** use an IAM user with **minimum permissions** (ECR push +
> EC2 connect) — not your root or admin account.

---

## 11. Environment variables reference

All variables, per app, for a production deployment.

### 11.1 NestJS API (`apps/api/.env`)

```bash
# Server
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://pnm_admin:<PASSWORD>@<RDS_ENDPOINT>:5432/govnotice?sslmode=require

# Auth
JWT_SECRET=<generate-with-openssl-rand-hex-64>
JWT_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
ADMIN_EMAILS=ashok.ab.bhattaraii@gmail.com

# CORS — the Vercel domain(s) the frontend is served from.
WEB_ORIGIN=https://pnm.example.com

# Storage
STORAGE_DRIVER=s3
S3_BUCKET=pnm-documents-prod
S3_REGION=ap-south-1
MAX_UPLOAD_BYTES=10485760
ALLOWED_MIME=application/pdf,image/png,image/jpeg,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document

# AI service (private IP or service-discovery name)
AI_SERVICE_URL=http://10.0.x.x:8000
```

### 11.2 Python AI (`apps/ai/.env`)

```bash
PORT=8000
ENVIRONMENT=production

# Embeddings
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
EMBEDDING_DIM=384

# Qdrant
QDRANT_URL=https://xxxx.aws.cloud.qdrant.io:6333
QDRANT_API_KEY=<qdrant-cloud-api-key>
QDRANT_COLLECTION=notices

# OCR
TESSERACT_LANG=nep+eng

# LLM (optional — for generated RAG answers)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

### 11.3 Next.js web (Vercel env vars)

```bash
NEXT_PUBLIC_API_URL=https://api.pnm.example.com
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
```

---

## 12. DNS, SSL & HTTPS

### 12.1 ACM certificate (free)

Request a certificate in **ACM** for your API subdomain:

```bash
aws acm request-certificate \
  --domain-name api.pnm.example.com \
  --validation-method DNS \
  --region ap-south-1
```

Validate by adding the CNAME record ACM provides to your DNS. Once issued,
attach it to the ALB HTTPS listener.

### 12.2 ALB HTTPS listener

```bash
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=arn:aws:acm:ap-south-1:...:certificate/... \
  --default-actions Type=forward,TargetGroupArn=arn:aws:elasticloadbalancing:...:targetgroup/pnm-api-tg/...

# Redirect HTTP → HTTPS.
aws elbv2 create-listener \
  --load-balancer-arn arn:aws:elasticloadbalancing:... \
  --protocol HTTP \
  --port 80 \
  --default-actions 'Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
```

### 12.3 DNS records

| Record | Type | Value |
|--------|------|-------|
| `pnm.example.com` | CNAME | `cname.vercel-dns.com` (Vercel) |
| `api.pnm.example.com` | CNAME / A (alias) | ALB DNS name |

If using Route 53, create an **Alias A record** pointing to the ALB.

### 12.4 CORS checklist

In the API's `.env`, set:

```bash
WEB_ORIGIN=https://pnm.example.com
```

This drives `app.enableCors({ origin: ... })` in `main.ts`. After deploy,
verify by opening browser DevTools → Network → check CORS headers on API calls.

---

## 13. Monitoring & observability

### 13.1 CloudWatch Logs

Docker containers log to stdout. Forward them to CloudWatch:

```bash
# On each EC2 instance, install the CloudWatch agent.
sudo yum install -y amazon-cloudwatch-agent

# Or use the Docker logging driver (simpler):
docker run -d --name pnm-api \
  --log-driver=awslogs \
  --log-opt awslogs-region=ap-south-1 \
  --log-opt awslogs-group=/pnm/api \
  --log-opt awslogs-create-group=true \
  ...
```

### 13.2 CloudWatch alarms

Set up basic alarms (free tier allows 10):

| Alarm | Metric | Threshold |
|-------|--------|-----------|
| API unhealthy | ALB `UnHealthyHostCount` | ≥ 1 for 2 minutes |
| High CPU (API) | EC2 `CPUUtilization` | > 80% for 5 minutes |
| High CPU (AI) | EC2 `CPUUtilization` | > 90% for 5 minutes |
| DB connections | RDS `DatabaseConnections` | > 80 |
| DB free storage | RDS `FreeStorageSpace` | < 2 GB |

### 13.3 Health checks

- **ALB** pings `GET /auth/admin/ping` on the API (returns `{ ok: true }`).
- **AI service**: add a `/health` route (already exists) and configure a simple
  uptime check (UptimeRobot free, or a Lambda-based check).

### 13.4 Application-level logging

Add structured JSON logs in the API:

```ts
// apps/api/src/main.ts
import { Logger } from '@nestjs/common';
// NestJS default logger outputs to stdout; CloudWatch ingests it.
```

For the AI service, Python's `logging` module to stdout is sufficient —
CloudWatch collects it via the Docker log driver.

---

## 14. Cost estimate

Monthly cost for a minimal production deployment (ap-south-1 pricing,
as of 2026):

| Service | Spec | Monthly cost |
|---------|------|:------------:|
| EC2 — API | `t3.medium` (reserved 1yr) | ~$21 |
| EC2 — AI | `t3.medium` (reserved 1yr) | ~$21 |
| RDS | `db.t3.micro`, 20 GB gp3 | **$0** (free tier yr 1) / ~$15 after |
| S3 | 5 GB storage + requests | < $1 |
| ALB | Base + LCUs | ~$18 |
| NAT Gateway | 1 AZ | ~$33 |
| ECR | < 1 GB images | < $1 |
| Qdrant Cloud | Free 1 GB tier | **$0** |
| Vercel | Free tier | **$0** |
| Route 53 | 1 hosted zone | $0.50 |
| ACM | Free certificates | **$0** |
| **Total (year 1)** | | **~$95/mo** |
| **Total (after free tier)** | | **~$110/mo** |

### Cost-saving tips

- **NAT Gateway** is the single biggest cost. Alternatives:
  - Use **NAT instances** (`t3.nano` ~$3/mo) for low traffic.
  - Or put EC2 in a public subnet with a strict security group (less ideal for security).
- **Spot instances** for the AI service (can tolerate brief interruptions): ~60% savings.
- **Single EC2** running both containers (API + AI in the same Docker network) saves one instance.
  Only do this if the AI workload is light.
- **Qdrant self-host on the AI EC2** instead of a dedicated instance (saves $21/mo but adds operational burden).

---

## 15. Deployment checklist

Execute in order:

### Infrastructure (one-time)
- [ ] Create VPC: 2 public subnets + 2 private subnets (2 AZs).
- [ ] Create NAT Gateway (or NAT instance) in a public subnet.
- [ ] Create security groups: `sg-alb`, `sg-api`, `sg-ai`, `sg-rds`.
- [ ] Create RDS PostgreSQL instance (§4).
- [ ] Create S3 bucket (§5).
- [ ] Create IAM role + instance profile with S3 policy.
- [ ] Create ECR repositories: `pnm-api`, `pnm-ai`.
- [ ] Create ALB in public subnets.
- [ ] Request ACM certificate + DNS validate (§12).
- [ ] Attach HTTPS listener to ALB (§12.2).
- [ ] Sign up for Qdrant Cloud free cluster (§8.1).

### Application deploy
- [ ] Build & push API Docker image to ECR (§6.2).
- [ ] Build & push AI Docker image to ECR (§7.2).
- [ ] Launch API EC2, attach instance profile, run Docker container (§6.3–6.5).
- [ ] Launch AI EC2, run Docker container (§7.3).
- [ ] Register API EC2 in ALB target group (§6.4).
- [ ] Run Prisma migrations against RDS (§4.3).
- [ ] Verify API health: `curl https://api.pnm.example.com/auth/admin/ping`.

### Frontend
- [ ] Connect repo to Vercel (§9.1).
- [ ] Set Vercel environment variables (§9.2).
- [ ] Add custom domain in Vercel + DNS CNAME (§9.3).
- [ ] Verify frontend loads and calls the API successfully.

### Validation
- [ ] Google OAuth: add `https://pnm.example.com` to authorized origins in
      Google Cloud Console.
- [ ] Upload a document via admin panel → verify it reaches S3 + Qdrant.
- [ ] Ask a RAG question → verify answer + sources returned.
- [ ] Check CloudWatch logs for both services.
- [ ] Trigger the CI/CD pipeline (push to `main`) and confirm auto-deploy.

---

*Cross-reference:*
- `docs/TechStackByModule.md` — technology choices and justification.
- `docs/DOCUMENT_SECTION_GUIDE.md` — detailed code for the Document feature.
- `docs/system-overview.md` — full system architecture and data flows.
