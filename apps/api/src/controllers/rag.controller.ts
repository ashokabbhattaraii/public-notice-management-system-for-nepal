import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { RagService } from '../services/rag.service';
import { QuotaService } from '../services/quota.service';
import { RagQueryDto } from '../dto/rag-query.dto';

@Controller('rag')
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly quota: QuotaService,
  ) {}

  @Post('query')
  @UseGuards(OptionalJwtAuthGuard)
  async query(@Body() dto: RagQueryDto, @CurrentUser() user: User | null) {
    // Anonymous visitors aren't metered — they can only reach system documents
    // anyway, and there's no account to bill. Signed-in users spend their
    // monthly AI allowance.
    if (user) await this.quota.assertCanAskAi(user.id);

    const answer = await this.ragService.query(dto.question, dto.documentId, dto.topK, user?.id);

    // Counted after the answer comes back, so a failed upstream call doesn't
    // burn the user's allowance.
    if (user) {
      await this.quota.recordAiQuestion(user.id, {
        surface: 'rag',
        documentId: dto.documentId ?? null,
      });
    }

    return answer;
  }
}
