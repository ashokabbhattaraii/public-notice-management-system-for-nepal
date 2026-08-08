import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CronJob } from 'cron';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Setting-type contract. `cron` is validated with the same `cron` library the
 * scheduler runs on, so a validator here and the runtime agree.
 */
export type SettingType =
  | 'boolean'
  | 'number'
  | 'cron'
  | 'text'
  | 'textarea'
  | 'select';

export interface SettingDefinition {
  key: string;
  group: string;
  label: string;
  description: string;
  type: SettingType;
  default: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface SettingRow extends SettingDefinition {
  value: string;
  overridden: boolean;
}

export interface SettingGroupMeta {
  id: string;
  label: string;
  description: string;
}

export interface SettingApplyResult {
  applied: { key: string; value: string }[];
  errors: { key: string; message: string }[];
}

/**
 * Known admin settings + persistence over the `app_settings` table.
 *
 * Every key in `definitions` is: typed (validated before persist), defaulted
 * (missing row = schema default) and independently resetable. Values are stored
 * as strings; runtime consumers use `getNumber`/`getBool`/`getString` helpers.
 */
@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  readonly groups: SettingGroupMeta[] = [
    {
      id: 'scheduling',
      label: 'Automation',
      description: 'Scraping scheduler cadence, concurrency and safety limits.',
    },
    {
      id: 'content',
      label: 'Content',
      description: 'How notice listings are paged across the app.',
    },
    {
      id: 'site',
      label: 'Branding & access',
      description: 'Public site identity and the maintenance-mode switch.',
    },
  ];

  readonly definitions: SettingDefinition[] = [
    {
      key: 'scraping.enabled',
      group: 'scheduling',
      label: 'Automatic scraping',
      description:
        'Master switch for the background scheduler. When off, sources only run when you start them manually.',
      type: 'boolean',
      default: 'true',
    },
    {
      key: 'scraping.cron',
      group: 'scheduling',
      label: 'Poll cadence',
      description:
        'Cron (6 fields: second minute hour DOM month weekday). e.g. `0 * * * * *` every minute, `0 8-20 * * *` on the hour 08:00–20:00.',
      type: 'cron',
      default: '0 * * * * *',
      placeholder: '0 * * * * *',
    },
    {
      key: 'scraping.concurrency',
      group: 'scheduling',
      label: 'Crawl concurrency',
      description:
        'Maximum full crawls that may run at once. Cheap sitemap checks do not count against this.',
      type: 'number',
      default: '3',
      min: 1,
      max: 10,
      step: 1,
      unit: 'parallel crawls',
    },
    {
      key: 'scraping.staleTimeoutSec',
      group: 'scheduling',
      label: 'Stale-run timeout',
      description:
        'A RUNNING scrape older than this is reclaimed as failed (crashed process) so the source becomes pollable again.',
      type: 'number',
      default: '3600',
      min: 60,
      max: 2592000,
      step: 300,
      unit: 'seconds',
    },
    {
      key: 'scraping.minPollSec',
      group: 'scheduling',
      label: 'Minimum poll interval',
      description:
        'Politeness floor — no source is polled more often than this, even sources with a cheap sitemap.',
      type: 'number',
      default: '60',
      min: 5,
      max: 86400,
      step: 15,
      unit: 'seconds',
    },
    {
      key: 'scraping.summarizeConcurrency',
      group: 'scheduling',
      label: 'LLM summarize concurrency',
      description:
        'Max concurrent AI summarization calls per scrape run. Raise this if your Groq/Gemini tier allows higher throughput; keep low to stay under rate limits.',
      type: 'number',
      default: '2',
      min: 1,
      max: 30,
      step: 1,
      unit: 'parallel calls',
    },
    {
      key: 'notices.perPage',
      group: 'content',
      label: 'Notices per page',
      description: 'Default page size for notice listings when a request omits one.',
      type: 'number',
      default: '20',
      min: 10,
      max: 100,
      step: 10,
      unit: 'notices',
    },
    {
      key: 'site.title',
      group: 'site',
      label: 'Site title',
      description:
        'Brand name used in the header and shared SEO metadata; published via GET /public/settings.',
      type: 'text',
      default: 'Suchana AI — Public Notice Management System',
      placeholder: 'Suchana AI — Public Notice Management System',
    },
    {
      key: 'site.description',
      group: 'site',
      label: 'Site description',
      description:
        'One-line tagline published by GET /public/settings for the footer and SEO metadata.',
      type: 'textarea',
      default: "Nepal's centralized repository for public government notices.",
      placeholder: "Nepal's centralized repository for public government notices.",
    },
    {
      key: 'maintenance.enabled',
      group: 'site',
      label: 'Maintenance mode',
      description:
        'When on, public API routes return 503. Admin routes, /health and /auth stay reachable so you can always turn it back off.',
      type: 'boolean',
      default: 'false',
    },
  ];

  private readonly definitionByKey = new Map(
    this.definitions.map((d) => [d.key, d]),
  );

  constructor(private readonly prisma: PrismaService) {}

  /** Migrate the pre-settings-page `auto_scraping` row into the new key. */
  async onModuleInit() {
    const legacy = await this.prisma.appSetting.findUnique({
      where: { key: 'auto_scraping' },
    });
    if (!legacy) return;
    const migrated = await this.prisma.appSetting.findUnique({
      where: { key: 'scraping.enabled' },
    });
    if (!migrated) {
      await this.prisma.appSetting.create({
        data: { key: 'scraping.enabled', value: legacy.value },
      });
      this.logger.log('Migrated legacy auto_scraping setting → scraping.enabled');
    }
    await this.prisma.appSetting.delete({ where: { key: 'auto_scraping' } });
  }

  definition(key: string): SettingDefinition | undefined {
    return this.definitionByKey.get(key);
  }

  has(key: string): boolean {
    return this.definitionByKey.has(key);
  }

  /** None for a key that does not exist in the schema. */
  async getString(key: string, fallback = ''): Promise<string> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return row ? row.value : fallback;
  }

  async getBoolean(key: string, fallback = false): Promise<boolean> {
    const v = await this.getString(key, fallback ? 'true' : 'false');
    return v === 'true';
  }

  async getNumber(key: string, fallback = 0): Promise<number> {
    const v = await this.getString(key, String(fallback));
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Effective value — persisted row else schema default. */
  async getEffective(key: string): Promise<string> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return row ? row.value : (this.definitionByKey.get(key)?.default ?? '');
  }

  /** Persist a single value (throws on unknown key / invalid value). */
  async set(key: string, value: string): Promise<void> {
    const def = this.definitionByKey.get(key);
    if (!def) throw new Error(`Unknown setting key: ${key}`);
    const error = this.validate(def, value);
    if (error) throw new Error(error);
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  /** Remove the persisted row so the schema default takes over again. */
  async reset(key: string): Promise<boolean> {
    if (!this.definitionByKey.has(key)) return false;
    const res = await this.prisma.appSetting.deleteMany({ where: { key } });
    return res.count > 0;
  }

  /**
   * Schema definitions merged with persisted values for the admin UI.
   * Unknown persisted keys (written by a future version) are preserved in the
   * DB but not surfaced, so downgrades don't lose data.
   */
  async listAll(): Promise<SettingRow[]> {
    const rows = await this.prisma.appSetting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return this.definitions.map((d) => ({
      ...d,
      value: byKey.get(d.key) ?? d.default,
      overridden: byKey.has(d.key),
    }));
  }

  /**
   * Validate + persist a batch. Every key is applied independently so a single
   * bad value never blocks the rest; failures are returned keyed.
   */
  async setMany(values: Record<string, string>): Promise<SettingApplyResult> {
    const applied: { key: string; value: string }[] = [];
    const errors: { key: string; message: string }[] = [];
    for (const [key, raw] of Object.entries(values)) {
      const def = this.definitionByKey.get(key);
      if (!def) {
        errors.push({ key, message: 'Unknown setting.' });
        continue;
      }
      const value = String(raw).trim();
      const errMsg = this.validate(def, value);
      if (errMsg) {
        errors.push({ key, message: errMsg });
        continue;
      }
      await this.prisma.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      applied.push({ key, value });
    }
    return { applied, errors };
  }

  /** One validation rule per type, shared by the API and `set()`. */
  validate(def: SettingDefinition, value: string): string | null {
    switch (def.type) {
      case 'boolean':
        return value === 'true' || value === 'false' ? null : 'Expected true or false.';
      case 'number': {
        const n = Number(value);
        if (!Number.isFinite(n)) return 'Expected a number.';
        if (def.min !== undefined && n < def.min) return `Minimum is ${def.min}.`;
        if (def.max !== undefined && n > def.max) return `Maximum is ${def.max}.`;
        if (def.step !== undefined && def.step > 1) {
          const fromBase = (n - (def.min ?? 0)) / def.step;
          if (Math.abs(fromBase - Math.round(fromBase)) > 1e-6) {
            return `Value must be a multiple of ${def.step}.`;
          }
        }
        return null;
      }
      case 'cron':
        return isValidCronExpression(value)
          ? null
          : 'Not a valid cron expression — the scheduler will reject it.';
      case 'select':
        return def.options?.some((o) => o.value === value)
          ? null
          : 'Pick one of the available options.';
      case 'text':
      case 'textarea':
        return value.trim().length > 0 ? null : 'Cannot be empty.';
      default:
        return null;
    }
  }

  /** Safe public subset for the frontend footer/SEO (no sensitive keys). */
  async publicSettings() {
    const [title, description] = await Promise.all([
      this.getEffective('site.title'),
      this.getEffective('site.description'),
    ]);
    return { site: { title, description } };
  }
}

/** Cron-validate with the exact library the scheduler executes (cron). */
export function isValidCronExpression(expression: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new CronJob(expression, () => undefined);
    return true;
  } catch {
    return false;
  }
}