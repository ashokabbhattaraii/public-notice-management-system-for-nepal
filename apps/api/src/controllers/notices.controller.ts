import { Controller, Get, Post, Param, ParseUUIDPipe, Query, Body, UseGuards } from '@nestjs/common';
import { User } from '@prisma/client';
import { NoticesService } from '../services/notices.service';
import { QuotaService } from '../services/quota.service';
import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AskNoticeDto } from '../dto/ask-notice.dto';

// Public read-only endpoints for browsing scraped notices/news — no auth
// required. Admin CRUD/trigger endpoints live under /admin/scraping.
@Controller('notices')
export class NoticesController {
  constructor(
    private readonly noticesService: NoticesService,
    private readonly quota: QuotaService,
  ) {}

  @Get()
  async findAll(
    @Query('category') category?: string,
    @Query('sourceId') sourceId?: string,
    @Query('search') search?: string,
    @Query('tag') tag?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('urgency') urgency?: string,
    @Query('sortBy') sortBy?: 'publishedAt' | 'views',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.noticesService.findAll({
      category,
      sourceId,
      search,
      tag,
      dateFrom,
      dateTo,
      urgency,
      sortBy,
      sortOrder,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('search')
  async search(
    @Body()
    body: {
      question: string;
      category?: string;
      language?: string;
      skipClarification?: boolean;
    },
  ) {
    if (!body.question?.trim()) {
      return { answer: '', sources: [], model_used: null };
    }
    return this.noticesService.search(
      body.question.trim(),
      body.category,
      body.language,
      body.skipClarification === true,
    );
  }

  @Get('meta/category-counts')
  async categoryCounts() {
    return this.noticesService.categoryCounts();
  }

  /** Minimal id/slug/updatedAt feed for the web app's public sitemap.xml. */
  @Get('meta/sitemap')
  async sitemapFeed(@Query('limit') limit?: string) {
    return this.noticesService.sitemapFeed(limit ? Number(limit) : undefined);
  }

  @Get('meta/sources')
  async listSources() {
    return this.noticesService.listSources();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.noticesService.findOne(id);
  }

  /**
   * Per-notice Q&A. Signed-in users spend their monthly AI allowance; the
   * guard is Optional so signed-out visitors can still try the assistant on
   * public notices (they have no account to meter).
   */
  @Post(':id/ask')
  @UseGuards(OptionalJwtAuthGuard)
  async ask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AskNoticeDto,
    @CurrentUser() user: User | null,
  ) {
    if (user) await this.quota.assertCanAskAi(user.id);

    const answer = await this.noticesService.askQuestion(id, dto.question);

    if (user) {
      await this.quota.recordAiQuestion(user.id, { surface: 'notice_ask', noticeId: id });
    }

    return answer;
  }
}
