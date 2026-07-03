import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

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
  ) {
    this.aiServiceUrl =
      this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
  }

  async query(
    question: string,
    documentId?: string,
    topK?: number,
  ): Promise<RagQueryResult> {
    try {
      const payload: Record<string, any> = { question };
      if (documentId) payload.doc_id = documentId;
      if (topK) payload.top_k = topK;

      const response = await firstValueFrom(
        this.httpService.post(`${this.aiServiceUrl}/query`, payload, {
          timeout: 60000, // 60 seconds for AI queries
        }),
      );

      return {
        answer: response.data.answer ?? '',
        sources: response.data.sources ?? [],
        model_used: response.data.model_used ?? 'unknown',
      };
    } catch (err: any) {
      this.logger.error(`RAG query failed: ${err.message}`);

      // Return a graceful error response instead of throwing
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
}
