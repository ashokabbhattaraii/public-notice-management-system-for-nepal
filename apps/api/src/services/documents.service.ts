import {
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
  ) {
    this.aiServiceUrl =
      this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
  }

  async create(data: {
    title: string;
    filename: string;
    mimeType: string;
    fileSize: number;
    filePath: string;
    uploadedBy: string;
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

  async findAll(dto: ListDocumentsDto) {
    const { page = 1, limit = 20, status } = dto;
    const skip = (page - 1) * limit;

    const where: Prisma.DocumentWhereInput = {};
    if (status) {
      where.status = status;
    }

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
          timeout: 120000, // 2 minutes timeout for large documents
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
      this.logger.error(
        `Document processing failed for ${document.id}: ${err.message}`,
      );

      await this.prisma.document.update({
        where: { id: document.id },
        data: { status: DocumentStatus.FAILED },
      });
    }
  }
}
