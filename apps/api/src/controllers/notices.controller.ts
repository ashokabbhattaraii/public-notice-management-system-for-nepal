import { Controller, Get, Post, Param, ParseUUIDPipe, Query, Body } from '@nestjs/common';
import { NoticesService } from '../services/notices.service';
import { AskNoticeDto } from '../dto/ask-notice.dto';

// Public read-only endpoints for browsing scraped notices/news — no auth
// required. Admin CRUD/trigger endpoints live under /admin/scraping.
@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

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
  async search(@Body() body: { question: string; category?: string; language?: string }) {
    if (!body.question?.trim()) {
      return { answer: '', sources: [], model_used: null };
    }
    return this.noticesService.search(body.question.trim(), body.category, body.language);
  }

  @Get('meta/category-counts')
  async categoryCounts() {
    return this.noticesService.categoryCounts();
  }

  @Get('meta/sources')
  async listSources() {
    return this.noticesService.listSources();
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.noticesService.findOne(id);
  }

  @Post(':id/ask')
  async ask(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AskNoticeDto) {
    return this.noticesService.askQuestion(id, dto.question);
  }
}
