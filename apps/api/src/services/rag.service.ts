import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';

export interface RagQueryResult {
  answer: string;
  sources: Array<{
    doc_id: string;
    chunk_index: number;
    content: string;
    score: number;
    title?: string;
  }>;
  model_used: string | null;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly aiServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.aiServiceUrl =
      this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
  }

  async query(
    question: string,
    documentId?: string,
    topK?: number,
    userId?: string,
  ): Promise<RagQueryResult> {
    try {
      // Determine which doc_ids this user is allowed to query
      const allowedDocIds = await this.getAllowedDocIds(userId, documentId);

      const payload: Record<string, any> = { question };
      if (documentId) {
        payload.doc_id = documentId;
      } else if (allowedDocIds) {
        payload.doc_ids = allowedDocIds;
      }
      if (topK) payload.top_k = topK;

      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/query`, payload, {
          timeout: 60000,
        }),
      );

      return {
        answer: response.data.answer ?? '',
        sources: response.data.sources ?? [],
        model_used: response.data.model_used ?? 'unknown',
      };
    } catch (err: any) {
      this.logger.error(`RAG query failed: ${err.message}`);

      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        return {
          answer:
            'The AI service is currently unavailable. Please try again later.',
          sources: [],
          model_used: 'none',
        };
      }

      throw err;
    }
  }

  /**
   * Get the list of document IDs the user is allowed to query.
   * - Anonymous users: only system docs
   * - Logged-in users: system docs + their own docs
   * - If a specific documentId is provided, we trust the caller (controller
   *   can add ownership checks if needed).
   */
  private async getAllowedDocIds(
    userId?: string,
    specificDocId?: string,
  ): Promise<string[] | null> {
    if (specificDocId) return null; // Single doc query, no filtering needed

    const where = userId
      ? { OR: [{ isSystem: true }, { uploadedBy: userId }] }
      : { isSystem: true };

    const docs = await this.prisma.document.findMany({
      where: { ...where, status: 'INDEXED' },
      select: { id: true },
    });

    return docs.map((d) => d.id);
  }
}
