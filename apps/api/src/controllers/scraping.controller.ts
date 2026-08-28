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
  BadRequestException,
} from '@nestjs/common';
import { Role, ScrapeRunStatus } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { ScrapingService } from '../services/scraping.service';
import { ScrapingSchedulerService } from '../services/scraping-scheduler.service';
import { NoticesService } from '../services/notices.service';
import { CreateScrapeSourceDto, UpdateScrapeSourceDto } from '../dto/scrape-source.dto';
import { ScrapedItemCategory } from '@prisma/client';

@Controller('admin/scraping')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class ScrapingController {
  constructor(
    private readonly scrapingService: ScrapingService,
    private readonly scheduler: ScrapingSchedulerService,
    private readonly noticesService: NoticesService,
  ) {}

  /** Effective scheduler configuration + last tick, for the admin UI. */
  @Get('scheduler')
  async schedulerStatus() {
    return this.scheduler.getSchedulerStatus();
  }

  /** Global on/off switch for automatic scraping. Manual runs are unaffected. */
  @Patch('scheduler/auto-scraping')
  async setAutoScraping(@Body('enabled') enabled?: boolean) {
    if (typeof enabled !== 'boolean') {
      throw new BadRequestException('enabled must be a boolean');
    }
    await this.scheduler.setAutoScraping(enabled);
    return this.scheduler.getSchedulerStatus();
  }

  /** Bulk trigger: runs every enabled source that isn't already scraping. */
  @Post('sources/run-all')
  async runAllSources(
    @Body('categories') categories?: ('NOTICE' | 'NEWS' | 'PRESS_RELEASE')[],
  ) {
    return this.scrapingService.runAllSources(categories);
  }

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

  /** One-time sitemap detection (robots.txt → sitemap.xml → best child).
   * Persists the cached sitemap URL on the source; safe to call again. */
  @Post('sources/:id/detect-sitemap')
  async detectSitemap(@Param('id', ParseUUIDPipe) id: string) {
    return this.scrapingService.detectSitemap(id);
  }

  /** Cheap sitemap poll — returns the sitemap's URLs not yet known to this
   * source, without triggering a full crawl. */
  @Post('sources/:id/check')
  async checkSitemap(@Param('id', ParseUUIDPipe) id: string) {
    return this.scrapingService.checkSitemap(id);
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

  /**
   * Re-run attachment text extraction for every notice whose stored text looks
   * unusable (`scope=garbled`, the default) or for all of them (`scope=all`).
   * Returns as soon as the work is queued; extraction continues in background.
   */
  @Post('items/reextract')
  async reextractItems(
    @Body('scope') scope?: 'garbled' | 'all',
    @Body('limit') limit?: number,
  ) {
    if (scope && scope !== 'garbled' && scope !== 'all') {
      throw new BadRequestException("scope must be 'garbled' or 'all'");
    }
    return this.noticesService.reextractBulk(scope ?? 'garbled', limit ?? 200);
  }

  /**
   * Report (and with `deleteThem: true`, remove) catalogue rows that are not
   * real notices — the "(untitled)" placeholders stored before the scraper
   * had admission control. Dry run unless deletion is explicitly requested.
   */
  @Post('items/cleanup-junk')
  async cleanupJunk(
    @Body('deleteThem') deleteThem?: boolean,
    @Body('limit') limit?: number,
  ) {
    return this.scrapingService.cleanupJunkItems({ deleteThem: deleteThem === true, limit });
  }

  /** Re-run extraction for a single notice, overwriting its stored text. */
  @Post('items/:id/reextract')
  async reextractItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.noticesService.reextract(id);
  }

  @Get('runs')
  async listRuns(
    @Query('sourceId') sourceId?: string,
    @Query('status') status?: ScrapeRunStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.scrapingService.listRuns({
      sourceId,
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('runs/:id/progress')
  async runProgress(@Param('id', ParseUUIDPipe) id: string) {
    return this.scrapingService.getRunProgress(id);
  }

  /** Re-run the source a given run belongs to — retry directly from a failed run row. */
  @Post('runs/:id/retry')
  async retryRun(@Param('id', ParseUUIDPipe) id: string) {
    return this.scrapingService.retryRun(id);
  }

  /** Admin correction: update category, tags, and trigger re-classification. */
  @Patch('items/:id')
  async correctNotice(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      category?: ScrapedItemCategory;
      tags?: string[];
      aiCategoryConfidence?: number;
      reClassify?: boolean;
    },
  ) {
    if (body.reClassify) {
      // Re-run full AI analysis on the existing content
      return this.scrapingService.reClassifyNotice(id);
    }
    const data: any = {};
    if (body.category) data.category = body.category;
    if (body.tags !== undefined) data.tags = body.tags;
    if (body.aiCategoryConfidence !== undefined) data.aiCategoryConfidence = body.aiCategoryConfidence;
    return this.scrapingService.updateNotice(id, data);
  }
}
