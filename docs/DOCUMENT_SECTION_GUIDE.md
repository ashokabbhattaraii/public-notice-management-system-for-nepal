# Document Section — From Scratch, End-to-End Implementation Guide

> AI-Powered Cloud-Based Public Notice Management System for Nepal
> Author: Ashok Bhattarai (NP069811) — derived from the FYP investigation report.

This guide walks you through building the **Document section** of the platform
from nothing to a working vertical slice: upload → store → extract text →
OCR (Tesseract) → chunk → embed → index in a vector store → expose to the RAG
chat. It is written to match the conventions **already used in this monorepo**
so the new code drops cleanly into the existing apps.

It is deliberately long and explains *why* at each step, not just *what*.

---

## Table of Contents

1. [What "Document section" means here](#1-what-document-section-means-here)
2. [Tech stack for this feature](#2-tech-stack-for-this-feature)
3. [Architecture & data flow](#3-architecture--data-flow)
4. [Phase 0 — Prerequisites & environment](#4-phase-0--prerequisites--environment)
5. [Phase 1 — Shared types](#5-phase-1--shared-types)
6. [Phase 2 — Database model (Prisma)](#6-phase-2--database-model-prisma)
7. [Phase 3 — Storage abstraction (local → S3)](#7-phase-3--storage-abstraction-local--s3)
8. [Phase 4 — NestJS Documents module (API)](#8-phase-4--nestjs-documents-module-api)
9. [Phase 5 — AI service: extraction, OCR, embeddings, vector index](#9-phase-5--ai-service-extraction-ocr-embeddings-vector-index)
10. [Phase 6 — Wiring API → AI service](#10-phase-6--wiring-api--ai-service)
11. [Phase 7 — Frontend Document section (Next.js)](#11-phase-7--frontend-document-section-nextjs)
12. [Phase 8 — Connect documents to the RAG chat](#12-phase-8--connect-documents-to-the-rag-chat)
13. [Phase 9 — Testing](#13-phase-9--testing)
14. [Phase 10 — Deployment notes (AWS)](#14-phase-10--deployment-notes-aws)
15. [Build order checklist](#15-build-order-checklist)

---

## 1. What "Document section" means here

In this system a **Document** is an uploaded or scraped file (PDF, DOCX, image,
or TXT) that backs a public notice and/or feeds the RAG knowledge base. The
`Document` domain type already exists in `packages/types/src/index.ts`:

```ts
export interface Document {
  id: string
  noticeId?: string
  filename: string
  mimeType: string
  sizeBytes: number
  isOcr: boolean
  uploadedAt: string
}
```

The Document section is responsible for the full lifecycle:

| Stage | Where it runs | Responsibility |
|-------|---------------|----------------|
| Upload | `apps/web` → `apps/api` | Accept a file from an admin, validate it |
| Persist file | `apps/api` (storage layer) | Write bytes to disk / S3, record metadata in Postgres |
| Extract text | `apps/ai` | PDF/DOCX/TXT text extraction |
| OCR | `apps/ai` | Tesseract for scanned PDFs/images (`nep+eng`) |
| Chunk + embed | `apps/ai` | Split text, create embeddings |
| Index | `apps/ai` | Store vectors in Qdrant |
| Query | `apps/ai` ← `apps/api` ← `apps/web` | RAG answers cite document chunks |

Access control (from the system overview): **only Admins** upload/manage
documents; Users and Admins can query them through RAG.

---

## 2. Tech stack for this feature

Everything below is already in the repo unless marked **(add)**.

### Backend API (`apps/api`) — NestJS 11 + Prisma 6
- `@nestjs/platform-express` + **`multer`** (installed) for multipart upload via `FileInterceptor`.
- **`file-type`** (installed) to verify the real MIME type from magic bytes (never trust the client-sent type).
- **`uuid`** (installed) for storage keys.
- Existing auth primitives: `JwtAuthGuard`, `RolesGuard`, `@Roles('admin')`, `@CurrentUser()`.
- **(add)** `@aws-sdk/client-s3` only when you move from local disk to S3.

### AI service (`apps/ai`) — Python ASGI + uvicorn
Current `requirements.txt` is minimal (`uvicorn`, `httpx`, `ruff`). **Add**:

```txt
# Text extraction
pypdf>=4.2.0
python-docx>=1.1.0
# OCR
pytesseract>=0.3.10
pdf2image>=1.17.0
Pillow>=10.3.0
# Embeddings + vector store
sentence-transformers>=3.0.0
qdrant-client>=1.9.0
# RAG orchestration (optional but in the report's stack)
langchain>=0.2.0
langchain-community>=0.2.0
```

System packages (the report names Tesseract; `pdf2image` needs Poppler):

```bash
# macOS
brew install tesseract tesseract-lang poppler
# Debian/Ubuntu (for AWS EC2 deploy)
sudo apt-get install -y tesseract-ocr tesseract-ocr-nep poppler-utils
```

### Frontend (`apps/web`) — Next.js 15 + Tailwind 4 + shadcn/ui
- Reuse existing `components/ui/*` (`button`, `card`, `dialog`, `badge`, `input`, `tabs`).
- Reuse `lib/api.ts` (`apiFetch`, `tokenStore`) — extend it with a multipart helper.

---

## 3. Architecture & data flow

```
            ┌──────────────────── apps/web (Next.js) ────────────────────┐
            │  /admin/documents      DocumentUpload     DocumentList      │
            └───────────────┬───────────────────────────────┬───────────┘
                            │ multipart POST /documents       │ GET /documents
                            ▼ (Bearer JWT, admin)             ▼
            ┌──────────────────── apps/api (NestJS) ─────────────────────┐
            │  DocumentsController → DocumentsService                     │
            │     • validate (size, magic-byte MIME)                      │
            │     • StorageService.save(bytes)  ── disk/S3                │
            │     • prisma.document.create(...)                           │
            │     • POST file/text to AI service for indexing            │
            └───────────────┬─────────────────────────────┬─────────────┘
                            │ Postgres (metadata)           │ httpx POST /documents
                            ▼                                ▼
                    ┌───────────────┐         ┌──────────── apps/ai (Python) ───────────┐
                    │  PostgreSQL   │         │  extract → OCR(Tesseract) → chunk        │
                    │  documents    │         │  → embed(MiniLM) → Qdrant upsert         │
                    └───────────────┘         │  /query: retrieve + answer (+ sources)   │
                                              └──────────────────────────────────────────┘
```

Two payload strategies for API → AI (pick one, this guide implements **A**):

- **A. API extracts nothing; sends the file** to AI which does extraction/OCR. Keeps all heavy AI libs in one place. Recommended.
- **B. API sends only a storage URL/S3 key**; AI fetches the bytes itself. Better once you are fully on S3.

---

## 4. Phase 0 — Prerequisites & environment

Add the document-related variables. **Do not commit real secrets** — update the
`.env.example` files and put real values in the git-ignored `.env`.

`apps/api/.env.example` (append):

```bash
# ── Documents ─────────────────────────────────────────
# local | s3
STORAGE_DRIVER=local
# Used when STORAGE_DRIVER=local. Folder is created on boot.
STORAGE_LOCAL_DIR=./storage/documents
# Max upload size in bytes (10 MB)
MAX_UPLOAD_BYTES=10485760
# Allowed MIME types (comma-separated)
ALLOWED_MIME=application/pdf,image/png,image/jpeg,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document

# Used when STORAGE_DRIVER=s3
S3_BUCKET=
S3_REGION=ap-south-1
# Leave blank on EC2/ECS to use the instance IAM role
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=

# AI service base URL (already present)
AI_SERVICE_URL=http://localhost:8000
```

`apps/ai/.env.example` — replace the old `VECTOR_DB_PATH` line with Qdrant settings:

```bash
EMBEDDING_MODEL=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2
TESSERACT_LANG=nep+eng

# Qdrant vector store
# Local dev: run Qdrant via Docker (see Phase 5.5). Prod: managed Qdrant Cloud URL.
QDRANT_URL=http://localhost:6333
# Leave blank for local; set for Qdrant Cloud.
QDRANT_API_KEY=
QDRANT_COLLECTION=notices
# Embedding dimension — must match the model (MiniLM-L12-v2 = 384).
EMBEDDING_DIM=384
```

Add `storage/` and the local Qdrant data directory to `.gitignore`:

```gitignore
storage/
apps/ai/qdrant_storage/
```

---

## 5. Phase 1 — Shared types

Extend the canonical `Document` type so every app agrees on its shape.
Edit `packages/types/src/index.ts`:

```ts
// Document processing lifecycle status.
export type DocumentStatus =
  | "pending"      // saved, not yet sent to AI
  | "processing"   // AI extracting/indexing
  | "indexed"      // searchable in RAG
  | "failed"       // extraction/indexing error

export interface Document {
  id: string
  noticeId?: string
  filename: string
  mimeType: string
  sizeBytes: number
  isOcr: boolean
  status: DocumentStatus
  // Storage key (disk path or S3 object key). Not exposed publicly.
  storageKey?: string
  // Extracted plain text length, handy for the admin UI.
  textLength?: number
  // Number of vector chunks indexed.
  chunkCount?: number
  errorMessage?: string
  uploadedAt: string
}

// Request body the API sends to the AI service for indexing.
export interface IndexDocumentRequest {
  documentId: string
  filename: string
  mimeType: string
}

// Response from the AI service after indexing.
export interface IndexDocumentResult {
  documentId: string
  isOcr: boolean
  textLength: number
  chunkCount: number
}
```

> The web app keeps its own richer `RagDocument` type in `apps/web/lib/types.ts`.
> Keep that for the existing RAG UI, but new code should prefer the shared
> `Document` type where possible.

---

## 6. Phase 2 — Database model (Prisma)

The existing schema (`apps/api/prisma/schema.prisma`) only has `User`. Add the
`Document` model and a status enum, mirroring the snake_case `@map` convention
already used.

```prisma
enum DocumentStatus {
  pending
  processing
  indexed
  failed
}

model Document {
  id           String         @id @default(uuid()) @db.Uuid
  // Optional link to a notice (attachments). Null for standalone RAG uploads.
  noticeId     String?        @map("notice_id") @db.Uuid
  filename     String
  mimeType     String         @map("mime_type")
  sizeBytes    Int            @map("size_bytes")
  // Storage key: relative disk path or S3 object key.
  storageKey   String         @map("storage_key")
  isOcr        Boolean        @default(false) @map("is_ocr")
  status       DocumentStatus @default(pending)
  textLength   Int?           @map("text_length")
  chunkCount   Int?           @map("chunk_count")
  errorMessage String?        @map("error_message")
  // Who uploaded it (admin). FK to users.
  uploadedById String         @map("uploaded_by_id") @db.Uuid
  uploadedBy   User           @relation(fields: [uploadedById], references: [id])
  createdAt    DateTime       @default(now()) @map("created_at")
  updatedAt    DateTime       @updatedAt @map("updated_at")

  @@index([status])
  @@index([noticeId])
  @@map("documents")
}
```

Add the back-relation to the existing `User` model:

```prisma
model User {
  // ... existing fields ...
  documents   Document[]     // add this line
  // ... existing @@map("users") ...
}
```

Generate the migration and client:

```bash
cd apps/api
pnpm prisma:migrate --name add_documents   # prisma migrate dev --name add_documents
pnpm prisma:generate
```

This produces a new SQL migration alongside the existing
`20260615185609_init`. After it runs, `PrismaService` exposes
`prisma.document`.

---

## 7. Phase 3 — Storage abstraction (local → S3)

Keep storage behind an interface so you can develop locally on disk and switch
to S3 in production by changing one env var. Create `apps/api/src/storage/`.

`apps/api/src/storage/storage.interface.ts`:

```ts
export interface SavedObject {
  /** Storage key used to retrieve/delete the object later. */
  key: string;
}

export interface StorageDriver {
  save(key: string, bytes: Buffer, mimeType: string): Promise<SavedObject>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
```

`apps/api/src/storage/local.storage.ts`:

```ts
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SavedObject, StorageDriver } from './storage.interface';

@Injectable()
export class LocalStorage implements StorageDriver {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = path.resolve(
      config.get<string>('STORAGE_LOCAL_DIR') ?? './storage/documents',
    );
  }

  private full(key: string) {
    // Prevent path traversal: keys are uuid-based and must stay under root.
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root)) {
      throw new Error('Invalid storage key');
    }
    return resolved;
  }

  async save(key: string, bytes: Buffer): Promise<SavedObject> {
    const dest = this.full(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, bytes);
    return { key };
  }

  read(key: string): Promise<Buffer> {
    return fs.readFile(this.full(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.full(key), { force: true });
  }
}
```

`apps/api/src/storage/s3.storage.ts` (used when `STORAGE_DRIVER=s3`; requires
`pnpm add @aws-sdk/client-s3` in `apps/api`):

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { SavedObject, StorageDriver } from './storage.interface';

@Injectable()
export class S3Storage implements StorageDriver {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: ConfigService) {
    this.bucket = config.get<string>('S3_BUCKET')!;
    this.client = new S3Client({ region: config.get('S3_REGION') });
    // On EC2/ECS the SDK uses the instance role automatically when keys are absent.
  }

  async save(key: string, bytes: Buffer, mimeType: string): Promise<SavedObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: bytes,
        ContentType: mimeType,
      }),
    );
    return { key };
  }

  async read(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return Buffer.from(await res.Body!.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
```

`apps/api/src/storage/storage.module.ts` — pick the driver from config:

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalStorage } from './local.storage';
import { S3Storage } from './s3.storage';
import { STORAGE_DRIVER } from './storage.interface';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_DRIVER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.get('STORAGE_DRIVER') === 's3'
          ? new S3Storage(config)
          : new LocalStorage(config),
    },
  ],
  exports: [STORAGE_DRIVER],
})
export class StorageModule {}
```

Register `StorageModule` in `apps/api/src/app.module.ts` imports.

> Tip: if you skip S3 entirely for now, you can delete `s3.storage.ts` and the
> factory branch. Add it back when you do the AWS phase.

---

## 8. Phase 4 — NestJS Documents module (API)

### 8.1 DTOs

`apps/api/src/documents/dto/list-documents.dto.ts`:

```ts
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListDocumentsDto {
  @IsOptional()
  @IsUUID()
  noticeId?: string;

  @IsOptional()
  @IsIn(['pending', 'processing', 'indexed', 'failed'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
```

`apps/api/src/documents/dto/create-document.dto.ts` (optional metadata sent
alongside the file in the multipart form):

```ts
import { IsOptional, IsUUID } from 'class-validator';

export class CreateDocumentDto {
  // Link the upload to an existing notice, if any.
  @IsOptional()
  @IsUUID()
  noticeId?: string;
}
```

### 8.2 Service

`apps/api/src/documents/documents.service.ts`:

```ts
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fileTypeFromBuffer } from 'file-type';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_DRIVER, StorageDriver } from '../storage/storage.interface';
import { AiClient } from './ai.client';
import { ListDocumentsDto } from './dto/list-documents.dto';

// text/plain has no magic bytes, so allow it explicitly by extension.
const TEXT_EXT = ['.txt'];

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly maxBytes: number;
  private readonly allowedMime: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    private readonly ai: AiClient,
    config: ConfigService,
  ) {
    this.maxBytes = Number(config.get('MAX_UPLOAD_BYTES') ?? 10_485_760);
    this.allowedMime = new Set(
      (config.get<string>('ALLOWED_MIME') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }

  async upload(
    file: Express.Multer.File,
    uploadedById: string,
    noticeId?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > this.maxBytes) {
      throw new BadRequestException('File exceeds maximum allowed size');
    }

    // Verify the REAL type from magic bytes; fall back to client type for .txt.
    const detected = await fileTypeFromBuffer(file.buffer);
    const isText =
      !detected && TEXT_EXT.some((e) => file.originalname.endsWith(e));
    const mimeType = detected?.mime ?? (isText ? 'text/plain' : file.mimetype);

    if (!this.allowedMime.has(mimeType)) {
      throw new BadRequestException(`Unsupported file type: ${mimeType}`);
    }

    // Storage key: random uuid keeps user-controlled filenames out of the path.
    const ext = detected?.ext ?? (isText ? 'txt' : 'bin');
    const key = `${uuid()}.${ext}`;
    await this.storage.save(key, file.buffer, mimeType);

    const doc = await this.prisma.document.create({
      data: {
        noticeId: noticeId ?? null,
        filename: file.originalname,
        mimeType,
        sizeBytes: file.size,
        storageKey: key,
        status: 'pending',
        uploadedById,
      },
    });

    // Kick off indexing without blocking the HTTP response.
    void this.index(doc.id, file.buffer, doc.filename, mimeType);

    return this.toPublic(doc);
  }

  /** Send bytes to the AI service and persist the result. */
  private async index(
    id: string,
    bytes: Buffer,
    filename: string,
    mimeType: string,
  ) {
    await this.prisma.document.update({
      where: { id },
      data: { status: 'processing' },
    });
    try {
      const res = await this.ai.indexDocument(id, bytes, filename, mimeType);
      await this.prisma.document.update({
        where: { id },
        data: {
          status: 'indexed',
          isOcr: res.isOcr,
          textLength: res.textLength,
          chunkCount: res.chunkCount,
          errorMessage: null,
        },
      });
    } catch (err) {
      this.logger.error(`Indexing failed for ${id}`, err as Error);
      await this.prisma.document.update({
        where: { id },
        data: {
          status: 'failed',
          errorMessage: (err as Error).message.slice(0, 500),
        },
      });
    }
  }

  async list(q: ListDocumentsDto) {
    const where = {
      ...(q.noticeId ? { noticeId: q.noticeId } : {}),
      ...(q.status ? { status: q.status as any } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.document.count({ where }),
    ]);
    return {
      data: items.map((d) => this.toPublic(d)),
      total,
      page: q.page,
      limit: q.limit,
    };
  }

  async findOne(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.toPublic(doc);
  }

  async download(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    const bytes = await this.storage.read(doc.storageKey);
    return { doc, bytes };
  }

  async remove(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    await this.storage.delete(doc.storageKey).catch(() => undefined);
    await this.ai.deleteDocument(id).catch(() => undefined);
    await this.prisma.document.delete({ where: { id } });
    return { id, deleted: true };
  }

  // Never leak the raw storage key to clients.
  private toPublic(d: {
    id: string;
    noticeId: string | null;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    isOcr: boolean;
    status: string;
    textLength: number | null;
    chunkCount: number | null;
    errorMessage: string | null;
    createdAt: Date;
  }) {
    return {
      id: d.id,
      noticeId: d.noticeId ?? undefined,
      filename: d.filename,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      isOcr: d.isOcr,
      status: d.status,
      textLength: d.textLength ?? undefined,
      chunkCount: d.chunkCount ?? undefined,
      errorMessage: d.errorMessage ?? undefined,
      uploadedAt: d.createdAt.toISOString(),
    };
  }
}
```

### 8.3 AI client (API → Python)

`apps/api/src/documents/ai.client.ts` — uses Node's built-in `fetch`
(`FormData`/`Blob` are global in Node 18+; this repo targets Node 22):

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IndexDocumentResult } from '@pnm/types';

@Injectable()
export class AiClient {
  private readonly base: string;

  constructor(config: ConfigService) {
    this.base = config.get<string>('AI_SERVICE_URL') ?? 'http://localhost:8000';
  }

  async indexDocument(
    documentId: string,
    bytes: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<IndexDocumentResult> {
    const form = new FormData();
    form.append('document_id', documentId);
    form.append(
      'file',
      new Blob([bytes], { type: mimeType }),
      filename,
    );

    const res = await fetch(`${this.base}/documents`, {
      method: 'POST',
      body: form,
    });
    if (!res.ok) {
      throw new Error(`AI index failed (${res.status}): ${await res.text()}`);
    }
    return (await res.json()) as IndexDocumentResult;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await fetch(`${this.base}/documents/${documentId}`, { method: 'DELETE' });
  }
}
```

### 8.4 Controller

`apps/api/src/documents/documents.controller.ts` — note the reuse of the
existing `JwtAuthGuard`, `RolesGuard`, `@Roles`, `@CurrentUser`:

```ts
import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Body } from '@nestjs/common';
import type { Response } from 'express';
import { User } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { ListDocumentsDto } from './dto/list-documents.dto';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  // Admin-only upload. multipart/form-data: field "file" + optional "noticeId".
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: User,
  ) {
    return this.documents.upload(file, user.id, dto.noticeId);
  }

  // Listing requires login (User or Admin).
  @UseGuards(JwtAuthGuard)
  @Get()
  list(@Query() query: ListDocumentsDto) {
    return this.documents.list(query);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/download')
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const { doc, bytes } = await this.documents.download(id);
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(doc.filename)}"`,
    );
    res.send(bytes);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.remove(id);
  }
}
```

### 8.5 Module + registration

`apps/api/src/documents/documents.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiClient } from './ai.client';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [AuthModule], // for JwtAuthGuard/JwtStrategy availability
  controllers: [DocumentsController],
  providers: [DocumentsService, AiClient],
})
export class DocumentsModule {}
```

Add `StorageModule` and `DocumentsModule` to `app.module.ts`:

```ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,   // add
    AuthModule,
    NoticesModule,
    DocumentsModule, // add
    RagModule,
  ],
})
export class AppModule {}
```

> **Body size limit:** `FileInterceptor` streams through multer in memory by
> default. For 10 MB files that is fine. If you raise `MAX_UPLOAD_BYTES`
> significantly, configure multer limits in the interceptor
> (`FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } })`) and
> raise the Express body limit.

---

## 9. Phase 5 — AI service: extraction, OCR, embeddings, vector index

The current `apps/ai/app/main.py` is a single bare ASGI handler. We will keep
the ASGI style (no framework, matching the repo) but split logic into modules
and add real multipart parsing for the `/documents` upload.

> **Why multipart parsing manually?** The repo deliberately uses raw ASGI with
> no Starlette/FastAPI. The simplest robust option is to add a tiny multipart
> parser via the `python-multipart` package, OR switch this service to FastAPI.
> If you are allowed to add FastAPI, it makes file uploads trivial. Below shows
> **both**; choose one.

### 9.1 Module layout

```
apps/ai/app/
├── main.py            # ASGI entry (router)
├── extract.py         # PDF/DOCX/TXT text extraction + OCR
├── chunking.py        # text splitting
├── store.py           # Qdrant client + embeddings
└── config.py          # env settings
```

### 9.2 Config

`apps/ai/app/config.py`:

```python
import os

EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "384"))  # MiniLM-L12-v2 = 384
TESSERACT_LANG = os.getenv("TESSERACT_LANG", "nep+eng")

# Qdrant connection
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY") or None
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "notices")

# If a PDF yields fewer than this many characters of embedded text,
# treat it as scanned and run OCR.
OCR_TEXT_THRESHOLD = int(os.getenv("OCR_TEXT_THRESHOLD", "100"))
```

### 9.3 Extraction + OCR

`apps/ai/app/extract.py`:

```python
"""Text extraction for PDF, DOCX, TXT, and images, with Tesseract OCR fallback."""
import io

import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image

from .config import OCR_TEXT_THRESHOLD, TESSERACT_LANG


def extract_text(data: bytes, mime_type: str, filename: str) -> tuple[str, bool]:
    """Return (text, used_ocr)."""
    name = filename.lower()

    if mime_type == "application/pdf" or name.endswith(".pdf"):
        return _extract_pdf(data)
    if name.endswith(".docx") or "wordprocessingml" in mime_type:
        return _extract_docx(data), False
    if mime_type.startswith("image/"):
        return _ocr_image(data), True
    # text/plain and everything else
    return data.decode("utf-8", errors="ignore"), False


def _extract_pdf(data: bytes) -> tuple[str, bool]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    text = "\n".join((page.extract_text() or "") for page in reader.pages)

    # Scanned PDFs have little/no embedded text → OCR each rendered page.
    if len(text.strip()) >= OCR_TEXT_THRESHOLD:
        return text, False

    ocr_pages = []
    for image in convert_from_bytes(data, dpi=300):
        ocr_pages.append(pytesseract.image_to_string(image, lang=TESSERACT_LANG))
    return "\n".join(ocr_pages), True


def _extract_docx(data: bytes) -> str:
    import docx

    document = docx.Document(io.BytesIO(data))
    return "\n".join(p.text for p in document.paragraphs)


def _ocr_image(data: bytes) -> str:
    image = Image.open(io.BytesIO(data))
    return pytesseract.image_to_string(image, lang=TESSERACT_LANG)
```

### 9.4 Chunking

`apps/ai/app/chunking.py`:

```python
"""Split long text into overlapping chunks for embedding."""


def chunk_text(text: str, size: int = 800, overlap: int = 150) -> list[str]:
    text = " ".join(text.split())  # normalise whitespace
    if not text:
        return []
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + size, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = end - overlap  # overlap preserves context across boundaries
    return chunks
```

> You can replace this with LangChain's `RecursiveCharacterTextSplitter`
> (named in the report). The hand-rolled version keeps the dependency surface
> small and is easy to explain in the dissertation.

### 9.5 Vector store (Qdrant + embeddings)

We use **Qdrant** as the vector database. Unlike an embedded store, Qdrant runs
as its own service (a Docker container locally, or managed **Qdrant Cloud** in
production), and the AI service talks to it over HTTP/gRPC via `qdrant-client`.
We compute embeddings ourselves with `sentence-transformers` (multilingual
MiniLM, 384-dim) and pass the raw vectors to Qdrant — this keeps the embedding
model identical across index and query time.

`apps/ai/app/store.py`:

```python
"""Qdrant-backed vector store with multilingual sentence-transformer embeddings."""
import uuid
from functools import lru_cache

from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

from .config import (
    EMBEDDING_DIM,
    EMBEDDING_MODEL,
    QDRANT_API_KEY,
    QDRANT_COLLECTION,
    QDRANT_URL,
)


@lru_cache(maxsize=1)
def _embedder():
    # Loaded once and cached; downloads the model on first use.
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(EMBEDDING_MODEL)


def _embed(texts: list[str]) -> list[list[float]]:
    return _embedder().encode(texts, normalize_embeddings=True).tolist()


@lru_cache(maxsize=1)
def _client() -> QdrantClient:
    client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)
    # Create the collection once (idempotent). Cosine distance pairs well with
    # normalized embeddings.
    existing = {c.name for c in client.get_collections().collections}
    if QDRANT_COLLECTION not in existing:
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=qm.VectorParams(
                size=EMBEDDING_DIM, distance=qm.Distance.COSINE
            ),
        )
        # Index the document_id payload field so deletes/filters are fast.
        client.create_payload_index(
            collection_name=QDRANT_COLLECTION,
            field_name="document_id",
            field_schema=qm.PayloadSchemaType.KEYWORD,
        )
    return client


def _point_id(document_id: str, chunk: int) -> str:
    # Qdrant point IDs must be UUIDs or ints; derive a stable UUID per chunk.
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{document_id}:{chunk}"))


def index_chunks(document_id: str, chunks: list[str], filename: str) -> int:
    client = _client()
    # Remove any previous version of this document first (idempotent re-index).
    delete_document(document_id)
    if not chunks:
        return 0

    vectors = _embed(chunks)
    points = [
        qm.PointStruct(
            id=_point_id(document_id, i),
            vector=vectors[i],
            payload={
                "document_id": document_id,
                "filename": filename,
                "chunk": i,
                "text": chunks[i],
            },
        )
        for i in range(len(chunks))
    ]
    client.upsert(collection_name=QDRANT_COLLECTION, points=points)
    return len(chunks)


def delete_document(document_id: str) -> None:
    client = _client()
    client.delete(
        collection_name=QDRANT_COLLECTION,
        points_selector=qm.FilterSelector(
            filter=qm.Filter(
                must=[
                    qm.FieldCondition(
                        key="document_id",
                        match=qm.MatchValue(value=document_id),
                    )
                ]
            )
        ),
    )


def query(question: str, top_k: int = 4) -> dict:
    client = _client()
    vector = _embed([question])[0]
    hits = client.query_points(
        collection_name=QDRANT_COLLECTION,
        query=vector,
        limit=top_k,
        with_payload=True,
    ).points

    context = [h.payload.get("text", "") for h in hits]
    sources = [
        {
            "id": h.payload.get("document_id"),
            "title": h.payload.get("filename"),
            "score": round(h.score, 4),  # cosine similarity (higher = closer)
        }
        for h in hits
    ]
    return {"context": context, "sources": sources}
```

> **Why store the chunk text in the payload?** Qdrant returns the matching
> points; keeping the original chunk text in `payload["text"]` means the AI
> service can build the answer context without a second round-trip to Postgres.

### 9.5b Running Qdrant locally

Qdrant is a separate service. Run it with Docker for development:

```bash
# Persists data in ./apps/ai/qdrant_storage so it survives restarts.
docker run -p 6333:6333 -p 6334:6334 \
  -v "$(pwd)/apps/ai/qdrant_storage:/qdrant/storage" \
  qdrant/qdrant
```

The dashboard is then at `http://localhost:6333/dashboard`. For production use
**Qdrant Cloud** (free 1 GB cluster) and set `QDRANT_URL` + `QDRANT_API_KEY`.

### 9.6 ASGI entry (raw style, matching the repo)

`apps/ai/app/main.py` — replaces the stub. Adds multipart handling for
`/documents`, a `DELETE /documents/{id}` route, and a real `/query`:

```python
import json

from .chunking import chunk_text
from .extract import extract_text
from .store import delete_document, index_chunks, query as vector_query


async def app(scope, receive, send):
    if scope["type"] == "lifespan":
        await _handle_lifespan(receive, send)
        return

    assert scope["type"] == "http"
    path = scope["path"]
    method = scope["method"]

    if method == "GET" and path == "/health":
        return await json_response(send, {"status": "healthy"})

    if method == "POST" and path == "/documents":
        return await _index_document(scope, receive, send)

    if method == "DELETE" and path.startswith("/documents/"):
        doc_id = path.rsplit("/", 1)[-1]
        delete_document(doc_id)
        return await json_response(send, {"documentId": doc_id, "deleted": True})

    if method == "POST" and path == "/query":
        body = await read_body(receive)
        return await _query(send, body)

    await json_response(send, {"error": "Not found"}, status=404)


async def _index_document(scope, receive, send):
    # Parse multipart/form-data: fields document_id + file.
    from .multipart import parse_multipart  # see 9.7

    headers = dict(scope["headers"])
    content_type = headers.get(b"content-type", b"").decode()
    raw = await read_raw(receive)
    fields, files = parse_multipart(raw, content_type)

    document_id = fields.get("document_id", "")
    upload = files.get("file")
    if not upload:
        return await json_response(send, {"error": "file required"}, status=400)

    text, used_ocr = extract_text(
        upload["data"], upload["content_type"], upload["filename"]
    )
    chunks = chunk_text(text)
    count = index_chunks(document_id, chunks, upload["filename"])

    await json_response(
        send,
        {
            "documentId": document_id,
            "isOcr": used_ocr,
            "textLength": len(text),
            "chunkCount": count,
        },
        status=201,
    )


async def _query(send, body):
    question = body.get("question", "")
    top_k = int(body.get("topK", 4))
    result = vector_query(question, top_k=top_k)

    # Without an LLM key, return the retrieved context as a naive answer.
    # With OPENAI_API_KEY/ANTHROPIC_API_KEY, feed result["context"] to the LLM.
    answer = _compose_answer(question, result["context"])
    await json_response(
        send, {"question": question, "answer": answer, "sources": result["sources"]}
    )


def _compose_answer(question: str, context: list[str]) -> str:
    if not context:
        return "No relevant documents were found for your question."
    # Placeholder extractive answer. Swap for an LLM call in production.
    return context[0][:600]


async def _handle_lifespan(receive, send):
    while True:
        message = await receive()
        if message["type"] == "lifespan.startup":
            await send({"type": "lifespan.startup.complete"})
        elif message["type"] == "lifespan.shutdown":
            await send({"type": "lifespan.shutdown.complete"})
            return


async def read_raw(receive) -> bytes:
    body, more = b"", True
    while more:
        message = await receive()
        body += message.get("body", b"")
        more = message.get("more_body", False)
    return body


async def read_body(receive) -> dict:
    raw = await read_raw(receive)
    try:
        return json.loads(raw) if raw else {}
    except json.JSONDecodeError:
        return {}


async def json_response(send, data, status=200):
    body = json.dumps(data).encode("utf-8")
    await send({
        "type": "http.response.start",
        "status": status,
        "headers": [[b"content-type", b"application/json"]],
    })
    await send({"type": "http.response.body", "body": body})
```

### 9.7 Minimal multipart parser

Add `python-multipart` to `requirements.txt` and wrap it.
`apps/ai/app/multipart.py`:

```python
"""Thin wrapper over python-multipart for raw-ASGI file uploads."""
from streaming_form_data import StreamingFormDataParser  # if you prefer this lib
# Simpler: use the `multipart` package's MultipartParser.

from multipart import MultipartParser, parse_options_header


def parse_multipart(body: bytes, content_type: str):
    _, options = parse_options_header(content_type)
    boundary = options.get("boundary")
    fields: dict[str, str] = {}
    files: dict[str, dict] = {}

    parser = MultipartParser(body, boundary)
    for part in parser.parts():
        if part.filename:
            files[part.name] = {
                "filename": part.filename,
                "content_type": part.content_type or "application/octet-stream",
                "data": part.raw,
            }
        else:
            fields[part.name] = part.value
    return fields, files
```

> **Strong recommendation:** if your supervisor allows it, convert `apps/ai`
> to **FastAPI**. Then `/documents` becomes:
> ```python
> @app.post("/documents")
> async def index(document_id: str = Form(...), file: UploadFile = File(...)):
>     data = await file.read()
>     text, ocr = extract_text(data, file.content_type, file.filename)
>     ...
> ```
> This removes the hand-rolled multipart and lifespan code entirely. The rest
> of the modules (`extract`, `chunking`, `store`) are unchanged.

### 9.8 Run it

```bash
cd apps/ai
source .venv/bin/activate
pip install -r requirements.txt
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
# Smoke test:
curl -F "document_id=test-1" -F "file=@../../docs/sample.pdf" http://localhost:8000/documents
```

---

## 10. Phase 6 — Wiring API → AI service

This is already implemented by `AiClient` (Phase 4.3) and consumed in
`DocumentsService.index()`. The flow is:

1. Admin uploads → API saves bytes + metadata (`status=pending`).
2. API immediately responds with the document record (good UX — no waiting).
3. In the background, API sets `status=processing`, POSTs the file to
   `AI /documents`, and on success stores `isOcr`, `textLength`, `chunkCount`,
   `status=indexed`. On error → `status=failed` with `errorMessage`.

The web UI polls `GET /documents/:id` (or the list) to reflect status changes.

> **Production hardening:** replace the fire-and-forget `void this.index(...)`
> with a real job queue (BullMQ + Redis) so indexing survives API restarts and
> can retry. For the FYP scope, fire-and-forget with DB status tracking is an
> acceptable, demonstrable design — just call it out as future work.

Also update the existing `RagController` to proxy `/rag/query` to the AI
`/query` so the chat uses the same index:

```ts
// apps/api/src/rag/rag.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiClient } from '../documents/ai.client';

@Controller('rag')
export class RagController {
  constructor(private readonly ai: AiClient) {}

  @UseGuards(JwtAuthGuard)
  @Post('query')
  async query(@Body() body: { question: string; topK?: number }) {
    const res = await fetch(`${process.env.AI_SERVICE_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  }
}
```

(Export `AiClient` from `DocumentsModule` and import it into `RagModule`, or
move `AiClient` to a small shared `ai` module.)

---

## 11. Phase 7 — Frontend Document section (Next.js)

### 11.1 API helpers

Extend `apps/web/lib/api.ts` with document calls. `apiFetch` sets a JSON
`Content-Type`, so add a dedicated multipart helper (the browser must set the
multipart boundary itself — never set `Content-Type` manually for `FormData`).

```ts
// apps/web/lib/documents.ts
import { apiFetch, tokenStore } from "./api"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

export interface DocumentDTO {
  id: string
  noticeId?: string
  filename: string
  mimeType: string
  sizeBytes: number
  isOcr: boolean
  status: "pending" | "processing" | "indexed" | "failed"
  textLength?: number
  chunkCount?: number
  errorMessage?: string
  uploadedAt: string
}

interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export function listDocuments(page = 1, limit = 20) {
  return apiFetch<Paginated<DocumentDTO>>(`/documents?page=${page}&limit=${limit}`)
}

export function getDocument(id: string) {
  return apiFetch<DocumentDTO>(`/documents/${id}`)
}

export async function uploadDocument(
  file: File,
  noticeId?: string,
): Promise<DocumentDTO> {
  const form = new FormData()
  form.append("file", file)
  if (noticeId) form.append("noticeId", noticeId)

  const token = tokenStore.get()
  const res = await fetch(`${API_URL}/documents`, {
    method: "POST",
    // Do NOT set Content-Type; the browser adds the multipart boundary.
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  if (!res.ok) throw new Error((await res.text()) || "Upload failed")
  return res.json()
}

export function deleteDocument(id: string) {
  return apiFetch<{ id: string; deleted: boolean }>(`/documents/${id}`, {
    method: "DELETE",
  })
}

export function documentDownloadUrl(id: string) {
  return `${API_URL}/documents/${id}/download`
}
```

### 11.2 Upload component (shadcn-styled)

`apps/web/components/documents/document-upload.tsx`:

```tsx
"use client"

import { useRef, useState } from "react"
import { Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { uploadDocument } from "@/lib/documents"

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.txt,.docx"

export function DocumentUpload({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError(null)
    try {
      // Upload sequentially to keep server memory predictable.
      for (const file of Array.from(files)) {
        await uploadDocument(file)
      }
      onUploaded()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Button onClick={() => inputRef.current?.click()} disabled={busy}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {busy ? "Uploading…" : "Upload documents"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
```

### 11.3 Document list + status

`apps/web/components/documents/document-list.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { FileText, Trash2, Download, ScanLine } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DocumentDTO,
  deleteDocument,
  documentDownloadUrl,
  listDocuments,
} from "@/lib/documents"

const STATUS_VARIANT: Record<DocumentDTO["status"], string> = {
  indexed: "bg-emerald-500/15 text-emerald-500",
  processing: "bg-amber-500/15 text-amber-500",
  pending: "bg-zinc-500/15 text-zinc-400",
  failed: "bg-red-500/15 text-red-500",
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}

export function DocumentList({ refreshKey }: { refreshKey: number }) {
  const [docs, setDocs] = useState<DocumentDTO[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listDocuments()
      setDocs(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  // Poll while anything is still processing so the badge updates live.
  useEffect(() => {
    const pending = docs.some(
      (d) => d.status === "processing" || d.status === "pending",
    )
    if (!pending) return
    const t = setInterval(load, 2500)
    return () => clearInterval(t)
  }, [docs, load])

  async function onDelete(id: string) {
    await deleteDocument(id)
    setDocs((d) => d.filter((x) => x.id !== id))
  }

  if (loading && docs.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading documents…</p>
  }
  if (docs.length === 0) {
    return <p className="text-sm text-muted-foreground">No documents yet.</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {docs.map((d) => (
        <Card key={d.id} className="flex items-center gap-3 p-3">
          <FileText className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{d.filename}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(d.sizeBytes)}
              {d.chunkCount ? ` · ${d.chunkCount} chunks` : ""}
            </p>
            {d.status === "failed" && d.errorMessage && (
              <p className="truncate text-xs text-destructive">{d.errorMessage}</p>
            )}
          </div>
          {d.isOcr && (
            <Badge className="gap-1">
              <ScanLine className="size-3" /> OCR
            </Badge>
          )}
          <span
            className={`rounded px-2 py-0.5 text-xs ${STATUS_VARIANT[d.status]}`}
          >
            {d.status}
          </span>
          <a href={documentDownloadUrl(d.id)} target="_blank" rel="noreferrer">
            <Button variant="ghost" size="icon">
              <Download className="size-4" />
            </Button>
          </a>
          <Button variant="ghost" size="icon" onClick={() => onDelete(d.id)}>
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </Card>
      ))}
    </div>
  )
}
```

### 11.4 Admin page

`apps/web/app/admin/documents/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import { AdminLayout } from "@/components/admin/admin-layout"
import { DocumentUpload } from "@/components/documents/document-upload"
import { DocumentList } from "@/components/documents/document-list"

export default function AdminDocumentsPage() {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <AdminLayout>
      <div className="flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Documents</h1>
            <p className="text-sm text-muted-foreground">
              Upload notices and source files. Text is extracted (with OCR for
              scans) and indexed for RAG search.
            </p>
          </div>
          <DocumentUpload onUploaded={() => setRefreshKey((k) => k + 1)} />
        </header>
        <DocumentList refreshKey={refreshKey} />
      </div>
    </AdminLayout>
  )
}
```

Add a "Documents" link to the admin nav in
`components/admin/admin-layout.tsx` (follow the existing nav item pattern there).

> The repo's `CLAUDE.md` mandates presenting 2–3 design options before
> significant *visual* redesigns. The components above are functional scaffolds
> using existing primitives; when you want to *style* this section richly,
> present options first per that rule.

---

## 12. Phase 8 — Connect documents to the RAG chat

The RAG chat UI already exists (`apps/web/app/rag/page.tsx`,
`components/floating-chat.tsx`). Point it at the real backend:

```ts
// apps/web/lib/rag.ts
import { apiFetch } from "./api"

export interface RagResponse {
  question: string
  answer: string
  sources: { id: string; title: string; score: number }[]
}

export function askRag(question: string, topK = 4) {
  return apiFetch<RagResponse>("/rag/query", {
    method: "POST",
    body: JSON.stringify({ question, topK }),
  })
}
```

Replace the client-side stub (`lib/local-rag.ts`) usages in the chat components
with `askRag`. Render `sources` as chips linking to
`documentDownloadUrl(source.id)`.

Now the loop is closed: **upload a document → it gets indexed → ask a question
in chat → the answer cites that document.**

---

## 13. Phase 9 — Testing

### API (Jest — NestJS default; add `apps/api/test` specs)

```ts
// apps/api/test/documents.service.spec.ts (sketch)
describe("DocumentsService.upload", () => {
  it("rejects files over the size limit", async () => {
    await expect(
      service.upload({ size: 99_000_000, buffer: Buffer.from("x") } as any, "uid"),
    ).rejects.toThrow("maximum allowed size");
  });

  it("rejects disallowed mime types", async () => {
    // a buffer whose magic bytes resolve to an exe/zip not in ALLOWED_MIME
  });

  it("persists metadata and triggers indexing on a valid PDF", async () => {
    // mock StorageDriver + AiClient, assert prisma.document.create called
  });
});
```

Run: `cd apps/api && pnpm jest` (add a `test` script if missing).

### AI service (pytest)

```python
# apps/ai/tests/test_extract.py
from app.chunking import chunk_text


def test_chunk_overlap():
    text = "word " * 500
    chunks = chunk_text(text, size=800, overlap=150)
    assert len(chunks) >= 1
    assert all(len(c) <= 800 for c in chunks)


def test_txt_extraction():
    from app.extract import extract_text
    text, ocr = extract_text(b"hello nepal", "text/plain", "a.txt")
    assert "hello" in text and ocr is False
```

Run: `cd apps/ai && .venv/bin/python -m pytest`.

### Manual end-to-end

1. `pnpm dev` (web + api) and run the AI service.
2. Log in as an admin (email in `ADMIN_EMAILS`).
3. Upload a **digital** PDF → status should reach `indexed`, `isOcr=false`.
4. Upload a **scanned** PDF/image → `isOcr=true`, non-zero `chunkCount`.
5. Ask a question in `/rag` referencing the uploaded content → answer + source.
6. Delete the document → it disappears and is removed from the vector store.

---

## 14. Phase 10 — Deployment notes (AWS)

Matches the report's AWS direction:

- **Files:** set `STORAGE_DRIVER=s3`, create a private S3 bucket, give the API's
  EC2/ECS task an IAM role with `s3:PutObject/GetObject/DeleteObject` on that
  bucket only. No access keys in env on AWS.
- **Database:** point `DATABASE_URL` at RDS Postgres (or Neon). Run
  `pnpm prisma:deploy` (`prisma migrate deploy`) on release.
- **Vector store (Qdrant):** use **Qdrant Cloud** (free 1 GB tier) and set
  `QDRANT_URL` + `QDRANT_API_KEY` — no stateful service to operate yourself.
  Alternatively self-host the `qdrant/qdrant` container on ECS/EC2 with an
  attached EBS volume mounted at `/qdrant/storage`. Keep `qdrant-client`
  pointed at the right URL per environment; nothing else changes.
- **OCR:** the AI container image must install `tesseract-ocr`,
  `tesseract-ocr-nep`, and `poppler-utils`. Add them to the AI service's
  Dockerfile `apt-get install` line.
- **Large uploads:** if behind CloudFront/ALB, confirm body size limits; for
  files >10 MB prefer **S3 pre-signed upload URLs** (browser → S3 directly),
  then notify the API of the new object key. This avoids streaming big files
  through the API at all.
- **CORS:** `WEB_ORIGIN` already drives API CORS; set it to the deployed web
  origin.
- **Security reminder:** uploads are admin-only and MIME is verified by magic
  bytes; keep it that way. Never serve the raw storage key; downloads go
  through the authenticated `/documents/:id/download` route (or short-lived
  pre-signed URLs on S3).

---

## 15. Build order checklist

Work top to bottom; each step is independently verifiable.

- [ ] **Types** — extend `Document` in `packages/types`.
- [ ] **DB** — add `Document` model + `DocumentStatus`, run `prisma:migrate`.
- [ ] **Storage** — add `StorageModule` (Local driver), register globally.
- [ ] **API module** — DTOs, `AiClient`, `DocumentsService`, controller, module; register in `app.module.ts`.
- [ ] **Smoke test API** — `POST /documents` with a JWT (AI service can be down; status becomes `failed`, that's fine).
- [ ] **AI service** — add deps + system packages; implement `extract`, `chunking`, `store`, rewrite `main.py` (or move to FastAPI).
- [ ] **End-to-end index** — upload reaches `indexed` with real `chunkCount`.
- [ ] **Frontend** — `lib/documents.ts`, upload + list components, `/admin/documents` page + nav link.
- [ ] **RAG wiring** — proxy `/rag/query`, swap chat to `askRag`, show sources.
- [ ] **Tests** — API Jest + AI pytest + manual E2E.
- [ ] **AWS** — flip `STORAGE_DRIVER=s3`, RDS `DATABASE_URL`, OCR packages in Dockerfile.

---

### Notes on fidelity to the existing codebase

- Auth/role patterns (`JwtAuthGuard`, `RolesGuard`, `@Roles('admin')`,
  `@CurrentUser()`) are reused exactly as in `auth.controller.ts`.
- Prisma conventions (`@db.Uuid`, snake_case `@map`, `@@map`) match the existing
  `User` model and `init` migration.
- `multer`, `file-type`, `uuid`, `sharp` are already in the dependency tree —
  no new API deps needed unless/until you add `@aws-sdk/client-s3`.
- The AI service additions (`pypdf`, `pytesseract`, `pdf2image`,
  `sentence-transformers`, `qdrant-client`) line up with the report's stated
  stack (Tesseract OCR, Hugging Face models, LangChain). **Qdrant** replaces the
  report's ChromaDB choice as the vector store — a more production-ready,
  free/open-source option (see `docs/TechStackByModule.md`).
