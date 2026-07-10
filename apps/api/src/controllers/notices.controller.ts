import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { NoticesService } from '../services/notices.service';

// Public read-only endpoints for browsing scraped notices/news — no auth
// required. Admin CRUD/trigger endpoints live under /admin/scraping.
@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Get()
  async findAll(
    @Query('category') category?: 'NOTICE' | 'NEWS',
    @Query('sourceId') sourceId?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sortBy') sortBy?: 'publishedAt' | 'views',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.noticesService.findAll({
      category,
      sourceId,
      search,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
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
}
