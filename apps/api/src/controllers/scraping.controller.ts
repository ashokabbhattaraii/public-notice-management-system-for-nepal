import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ScrapingService } from '../services/scraping.service';
import { CreateScrapeSourceDto, UpdateScrapeSourceDto } from '../dto/scrape-source.dto';

@Controller('admin/scraping')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class ScrapingController {
  constructor(private readonly scrapingService: ScrapingService) {}

  @Get('sources')
  async listSources() {
    return this.scrapingService.listSources();
  }

  @Post('sources')
  async createSource(@Body() dto: CreateScrapeSourceDto) {
    return this.scrapingService.createSource(dto);
  }

  @Patch('sources/:id')
  async updateSource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScrapeSourceDto,
  ) {
    return this.scrapingService.updateSource(id, dto);
  }

  @Delete('sources/:id')
  async deleteSource(@Param('id', ParseUUIDPipe) id: string) {
    return this.scrapingService.deleteSource(id);
  }

  @Post('sources/:id/run')
  async runSource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('categories') categories?: ('NOTICE' | 'NEWS')[],
  ) {
    return this.scrapingService.runSource(id, categories);
  }

  @Get('items')
  async listItems(
    @Query('sourceId') sourceId?: string,
    @Query('category') category?: 'NOTICE' | 'NEWS',
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('sortBy') sortBy?: 'publishedAt' | 'scrapedAt' | 'title',
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.scrapingService.listItems({
      sourceId,
      category,
      search,
      dateFrom,
      dateTo,
      sortBy,
      sortOrder,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Delete('items/:id')
  async deleteItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.scrapingService.deleteItem(id);
  }

  @Get('runs')
  async listRuns(@Query('sourceId') sourceId?: string, @Query('limit') limit?: string) {
    return this.scrapingService.listRuns(sourceId, limit ? Number(limit) : 20);
  }

  @Get('runs/:id/progress')
  async runProgress(@Param('id', ParseUUIDPipe) id: string) {
    return this.scrapingService.getRunProgress(id);
  }
}
