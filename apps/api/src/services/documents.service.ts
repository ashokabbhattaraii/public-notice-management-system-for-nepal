import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Document, DocumentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListDocumentsDto } from '../dto/list-documents.dto';
import * as fs from 'fs';
import * as path from 'path';
import { firstValueFrom } from 'rxjs';
import FormData = require('form-data');

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly aiServiceUrl: string;
  private readonly aiIndexTimeoutMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl =
      this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
    // Large documents (OCR + embedding) can take a while; default 10 minutes.
    this.aiIndexTimeoutMs = Number(
      this.config.get<string>('AI_INDEX_TIMEOUT_MS') ?? 600000,
    );
  }

  async create(data: {
    id: string;
    title: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    filePath: string;
    uploadedBy: string;
    fileHash: string;
  }): Promise<Document> {
    const document = await this.prisma.document.create({ data });

    // Process asynchronously - don't block the upload response
    this.processDocument(document).catch((err) => {
      this.logger.error(
        `Failed to process document ${document.id}: ${err.message}`,
      );
    });

    return document;
  }

  /** Find a document by its content hash (for deduplication). */
  async findByHash(fileHash: string): Promise<Document | null> {
    return this.prisma.document.findFirst({
      where: { fileHash },
    });
  }

  async findAll(dto: ListDocumentsDto, userId?: string) {
    const { page = 1, limit = 20, status } = dto;
    const skip = (page - 1) * limit;

    // Show system docs to everyone; user docs only to their owner
    const where: Prisma.DocumentWhereInput = {
      AND: [
        // Scope: system docs OR docs owned by this user
        userId
          ? { OR: [{ isSystem: true }, { uploadedBy: userId }] }
          : { isSystem: true },
        // Optional status filter
        ...(status ? [{ status }] : []),
      ],
    };

    const [documents, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      data: documents,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<Document> {
    const document = await this.prisma.document.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    if (!document) {
      throw new NotFoundException(`Document with id ${id} not found`);
    }

    return document;
  }

  async remove(id: string): Promise<void> {
    const document = await this.findOne(id);

    // Try to remove from AI service vector store
    try {
      await firstValueFrom(
        this.httpService.delete(`${this.aiServiceUrl}/documents/${id}`),
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to delete document ${id} from AI service: ${err.message}`,
      );
      // Continue with local deletion even if AI service fails
    }

    // Delete file from disk
    try {
      const fullPath = path.resolve(document.filePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to delete file for document ${id}: ${err.message}`,
      );
    }

    // Delete from database
    await this.prisma.document.delete({ where: { id } });
  }

  /** Re-embed a document's file into the vector store. */
  async embed(id: string): Promise<Document> {
    const document = await this.findOne(id);

    if (document.status === DocumentStatus.PROCESSING) {
      throw new ConflictException('Document is already being processed');
    }
    if (document.status === DocumentStatus.INDEXED) {
      throw new ConflictException('Document is already embedded');
    }

    // Kick off asynchronously; the client polls status/progress.
    this.processDocument(document).catch((err) => {
      this.logger.error(`Failed to embed document ${id}: ${err.message}`);
    });

    return this.prisma.document.update({
      where: { id },
      data: { status: DocumentStatus.PROCESSING },
    });
  }

  /** Remove a document's vectors from the store but keep the file and record. */
  async unembed(id: string): Promise<Document> {
    const document = await this.findOne(id);

    if (document.status === DocumentStatus.PROCESSING) {
      throw new ConflictException(
        'Document is being processed; wait for it to finish',
      );
    }

    try {
      await firstValueFrom(
        this.httpService.delete(`${this.aiServiceUrl}/documents/${id}`),
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to remove vectors for document ${id}: ${err.message}`,
      );
      throw new ConflictException(
        'Could not remove document from the vector store. Is the AI service running?',
      );
    }

    return this.prisma.document.update({
      where: { id },
      data: {
        status: DocumentStatus.UNEMBEDDED,
        chunkCount: null,
        indexedAt: null,
      },
    });
  }

  /** Live ingestion progress for many documents in a single AI-service call. */
  async getProgressBatch(
    ids: string[],
  ): Promise<Record<string, Record<string, any> | null>> {
    if (ids.length === 0) return {};

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/progress`, {
          params: { ids: ids.join(',') },
          timeout: 5000,
        }),
      );
      return response.data.progress ?? {};
    } catch {
      // AI service unavailable — report nothing rather than failing the poll.
      return {};
    }
  }

  /** Proxy live ingestion progress from the AI service. */
  async getProgress(id: string): Promise<Record<string, any>> {
    const document = await this.findOne(id);

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/documents/${id}/progress`, {
          timeout: 5000,
        }),
      );
      return { ...response.data, status: document.status };
    } catch {
      // No live progress available (AI restarted, or processing not started).
      return { doc_id: id, stage: null, percent: null, status: document.status };
    }
  }

  getFilePath(document: Document): string {
    const fullPath = path.resolve(document.filePath);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('File not found on disk');
    }
    return fullPath;
  }

  async processDocument(document: Document): Promise<void> {
    // Mark as processing
    await this.prisma.document.update({
      where: { id: document.id },
      data: { status: DocumentStatus.PROCESSING },
    });

    try {
      const fullPath = path.resolve(document.filePath);
      const fileStream = fs.createReadStream(fullPath);

      const form = new FormData();
      form.append('file', fileStream, {
        filename: document.filename,
        contentType: document.mimeType,
      });
      form.append('document_id', document.id);
      form.append('title', document.title);

      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/documents`, form, {
          headers: {
            ...form.getHeaders(),
          },
          timeout: this.aiIndexTimeoutMs,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }),
      );

      const result = response.data;

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

      this.logger.log(`Document ${document.id} processed successfully`);
    } catch (err: any) {
      // The AI service reports why it failed in the response body ("Failed to
      // embed document: …", "No text could be extracted", …). Logging only
      // axios's "Request failed with status code 500" hides all of it.
      const upstream = err.response?.data?.error;
      const status = err.response?.status;
      this.logger.error(
        `Document processing failed for ${document.id}` +
          `${status ? ` (AI service ${status})` : ''}: ${upstream ?? err.message}`,
      );

      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.FAILED },
      });
    }
  }
}
