import {
  Body,
  BadRequestException,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  Put,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
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

/**
 * Service-to-service auth for InternalAiConfigController: a shared secret in
 * a header, not a user JWT — the caller (apps/ai) has no user identity to
 * present. Fails closed on both ends: if the server has no secret configured
 * at all, the route is treated as disabled (503) rather than silently open;
 * any mismatch is a plain 403 with no detail about which part was wrong.
 */
@Injectable()
class InternalServiceGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INTERNAL_SERVICE_SECRET');
    if (!expected) {
      throw new ServiceUnavailableException(
        'INTERNAL_SERVICE_SECRET is not configured on this server.',
      );
    }
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-internal-secret'];
    if (typeof provided !== 'string' || provided !== expected) {
      throw new ForbiddenException('Invalid internal service secret.');
    }
    return true;
  }
}

/**
 * Lets the AI service (apps/ai) pick up admin-configured LLM API
 * keys/models on a short polling interval, without a redeploy and without
 * ever putting a decrypted key through a user-facing endpoint. Only fields
 * the admin has actually overridden are included — null means "keep your
 * own env-var default", so an unconfigured field here never blanks out a
 * working env-based key on the AI service.
 */
@Controller('internal/ai-config')
@UseGuards(InternalServiceGuard)
export class InternalAiConfigController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async get() {
    const [
      groqApiKey,
      geminiApiKey,
      openCodeZenApiKey,
      groqModel,
      geminiModel,
      openCodeZenModel,
      providerPriority,
    ] = await Promise.all([
      this.settings.getSecret('ai.groqApiKey'),
      this.settings.getSecret('ai.geminiApiKey'),
      this.settings.getSecret('ai.openCodeZenApiKey'),
      this.settings.getIfOverridden('ai.groqModel'),
      this.settings.getIfOverridden('ai.geminiModel'),
      this.settings.getIfOverridden('ai.openCodeZenModel'),
      this.settings.getIfOverridden('ai.providerPriority'),
    ]);
    return {
      groqApiKey,
      geminiApiKey,
      openCodeZenApiKey,
      groqModel,
      geminiModel,
      openCodeZenModel,
      providerPriority,
    };
  }
}

/**
 * Live LLM provider health for the admin panel. Proxies to the AI service's
 * /llm/health, which makes a real (tiny) call to each configured provider —
 * so this reports what an actual request would hit right now, including the
 * effect of any priority/key change saved seconds ago.
 */
@Controller('admin/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class AdminAiHealthController {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  @Get('health')
  async health() {
    const baseUrl =
      this.config.get<string>('AI_SERVICE_URL') || 'http://localhost:8000';
    try {
      const response = await firstValueFrom(
        // Generous timeout: this fans out to three external providers, and a
        // rate-limited or slow one is exactly the case an admin is here to
        // diagnose — a premature timeout would hide it behind a generic error.
        this.http.get(`${baseUrl}/llm/health`, { timeout: 45000 }),
      );
      return response.data;
    } catch (err: any) {
      throw new ServiceUnavailableException(
        `Could not reach the AI service for a health check: ${err.message}`,
      );
    }
  }
}