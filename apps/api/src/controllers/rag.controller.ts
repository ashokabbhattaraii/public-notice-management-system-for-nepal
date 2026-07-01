import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RagService } from '../services/rag.service';
import { RagQueryDto } from '../dto/rag-query.dto';

@Controller('rag')
@UseGuards(JwtAuthGuard)
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('query')
  async query(@Body() dto: RagQueryDto) {
    return this.ragService.query(dto.question, dto.documentId, dto.topK);
  }
}
