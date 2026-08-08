import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { SettingsService } from '../services/settings.service';
import { ScrapingSchedulerService } from '../services/scraping-scheduler.service';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly scheduler: ScrapingSchedulerService,
  ) {}

  /** Admin UI catalog: schema definitions merged with persisted values. */
  @Get()
  async list() {
    const [settings, groups] = await Promise.all([
      this.settings.listAll(),
      Promise.resolve(this.settings.groups),
    ]);
    const byGroup = (group: string) => settings.filter((s) => s.group === group);
    return {
      groups: groups.map((g) => ({
        ...g,
        changed: byGroup(g.id).filter((s) => s.overridden).length,
      })),
      settings,
    };
  }

  /**
   * Batch apply. All-or-nothing is not enforced: valid keys are persisted and
   * invalid ones reported, so one misspelled field never blocks the rest.
   * Returns the fresh state plus a hint of what runtime subsystems were
   * re-applied as a side-effect.
   */
  @Put()
  async update(@Body() body: { values?: Record<string, string> }) {
    const values = body.values ?? (body as unknown as Record<string, string>);
    const result = await this.settings.setMany(values);

    const schedulerTouched = ['scraping.enabled', 'scraping.cron', 'scraping.concurrency',
      'scraping.staleTimeoutSec', 'scraping.minPollSec'].some(
      (k) => result.applied.some((a) => a.key === k),
    );
    const schedulerResult = schedulerTouched ? await this.scheduler.applyConfig() : undefined;

    const [groups, rows] = await Promise.all([Promise.resolve(this.settings.groups), this.settings.listAll()]);
    const view = {
      groups: groups.map((g) => ({
        ...g,
        changed: rows.filter((s) => s.group === g.id && s.overridden).length,
      })),
      settings: rows,
    };

    return {
      ...view,
      applied: result.applied,
      errors: result.errors,
      runtime: schedulerResult ? { scheduler: schedulerResult } : undefined,
    };
  }

  /** Restore the schema default for one key. */
  @Delete(':key')
  async reset(@Param('key') key: string) {
    const removed = await this.settings.reset(key);
    if (!removed) throw new BadRequestException(`Unknown setting key: ${key}`);
    if (['scraping.enabled', 'scraping.cron', 'scraping.concurrency',
      'scraping.staleTimeoutSec', 'scraping.minPollSec'].includes(key)) {
      await this.scheduler.applyConfig();
    }
    return { key, reset: true };
  }
}

/** Public, unauthenticated subset for the frontend footer/SEO. */
@Controller('public/settings')
export class PublicSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async publicSettings() {
    return this.settings.publicSettings();
  }
}