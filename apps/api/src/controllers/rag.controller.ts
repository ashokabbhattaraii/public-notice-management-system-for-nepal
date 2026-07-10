import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RagService } from '../services/rag.service';
import { RagQueryDto } from '../dto/rag-query.dto';

@Controller('rag')
export class RagController {
  constructor(private readonly ragService: RagService) {}

  @Post('query')
  @UseGuards(OptionalJwtAuthGuard)
  async query(
    @Body() dto: RagQueryDto,
    @CurrentUser() user: User | null,
  ) {
    return this.ragService.query(dto.question, dto.documentId, dto.topK, user?.id);
  }
}
