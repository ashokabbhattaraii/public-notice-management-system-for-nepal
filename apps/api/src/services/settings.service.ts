import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CronJob } from 'cron';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Setting-type contract. `cron` is validated with the same `cron` library the
 * scheduler runs on, so a validator here and the runtime agree. `secret` is
 * encrypted at rest (see encryptSecret/decryptSecret) and never round-trips
 * to the frontend in plaintext — listAll() returns a masked preview instead.
 */
export type SettingType =
  | 'boolean'
  | 'number'
  | 'cron'
  | 'text'
  | 'textarea'
  | 'select'
  | 'secret'
  // Ordered, toggleable subset of `options` stored comma-separated. Order is
  // meaningful (it IS the value); omitted options are disabled, not merely
  // unselected. Used for LLM provider fallback priority.
  | 'order';

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
  /** Secret fields only: true when a key is stored, without exposing it. */
  configured?: boolean;
  /** Secret fields only: masked last-4-chars preview, e.g. "••••8i830K". */
  preview?: string;
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
    {
      id: 'ai',
      label: 'AI & Models',
      description:
        'LLM provider API keys and model selection, applied to the AI service without a redeploy. Keys are encrypted at rest and never shown again once saved.',
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
    {
      key: 'ai.providerPriority',
      group: 'ai',
      label: 'Provider priority & fallback',
      description:
        'Order in which LLM providers are tried — the first one that answers wins, the rest are fallbacks. Drag to reorder; switch a provider off to stop it being used at all without deleting its key.',
      type: 'order',
      default: 'gemini,groq,opencode',
      options: [
        { value: 'gemini', label: 'Google Gemini' },
        { value: 'groq', label: 'Groq' },
        { value: 'opencode', label: 'OpenCode Zen' },
      ],
    },
    {
      key: 'ai.geminiApiKey',
      group: 'ai',
      label: 'Gemini API key',
      description:
        'Primary LLM provider for chat answers, notice summaries and classification. Get a key at aistudio.google.com. Leave unset to use this server\'s GEMINI_API_KEY environment variable instead.',
      type: 'secret',
      default: '',
      placeholder: 'AIza…',
    },
    {
      key: 'ai.geminiModel',
      group: 'ai',
      label: 'Gemini model',
      description: 'Model name passed to the Gemini generateContent API.',
      type: 'text',
      default: 'gemini-3.6-flash',
      placeholder: 'gemini-3.6-flash',
    },
    {
      key: 'ai.groqApiKey',
      group: 'ai',
      label: 'Groq API key',
      description:
        'Fallback LLM provider, tried when Gemini fails or is unconfigured. Get a key at console.groq.com. Leave unset to use this server\'s GROQ_API_KEY environment variable instead.',
      type: 'secret',
      default: '',
      placeholder: 'gsk_…',
    },
    {
      key: 'ai.groqModel',
      group: 'ai',
      label: 'Groq model',
      description: 'Model name passed to the Groq chat completions API.',
      type: 'text',
      default: 'openai/gpt-oss-120b',
      placeholder: 'openai/gpt-oss-120b',
    },
    {
      key: 'ai.openCodeZenApiKey',
      group: 'ai',
      label: 'OpenCode Zen API key',
      description:
        'Third-tier free fallback, tried only when both Gemini and Groq fail or are unconfigured.',
      type: 'secret',
      default: '',
    },
    {
      key: 'ai.openCodeZenModel',
      group: 'ai',
      label: 'OpenCode Zen model',
      description: 'Model name passed to the OpenCode Zen chat completions API.',
      type: 'text',
      default: 'deepseek-v4-flash-free',
      placeholder: 'deepseek-v4-flash-free',
    },
  ];

  private readonly definitionByKey = new Map(
    this.definitions.map((d) => [d.key, d]),
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Secret encryption (AES-256-GCM) ─────────────────────────────────────
  //
  // API keys are never stored in plaintext. The key column already holds
  // arbitrary strings (`app_settings.value`), so the ciphertext just goes in
  // that same column — no schema change needed. Format: "v1:<iv>:<tag>:<ct>",
  // each part base64. GCM's auth tag means a tampered row fails to decrypt
  // loudly rather than silently returning garbage.

  private encryptionKey(): Buffer {
    const raw = this.config.get<string>('SETTINGS_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error(
        'SETTINGS_ENCRYPTION_KEY is not configured on this server — cannot store or read secret settings.',
      );
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error('SETTINGS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    }
    return key;
  }

  private encryptSecret(plain: string): string {
    const key = this.encryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return ['v1', iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
  }

  private decryptSecret(stored: string): string {
    const [version, ivB64, tagB64, dataB64] = stored.split(':');
    if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
      throw new Error('Unrecognized secret encoding.');
    }
    const key = this.encryptionKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return plain.toString('utf8');
  }

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
    const stored = def.type === 'secret' ? this.encryptSecret(value) : value;
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value: stored },
      update: { value: stored },
    });
  }

  /**
   * Decrypted value of a `secret`-type setting, or null if it's never been
   * set. Server-side use only (e.g. the internal AI-config endpoint) —
   * never wire this into anything a browser response can reach.
   */
  async getSecret(key: string): Promise<string | null> {
    const def = this.definitionByKey.get(key);
    if (!def || def.type !== 'secret') return null;
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    if (!row) return null;
    try {
      return this.decryptSecret(row.value);
    } catch (e: any) {
      this.logger.warn(`Failed to decrypt secret setting "${key}": ${e.message}`);
      return null;
    }
  }

  /**
   * Raw persisted value, or null if this key has never been overridden.
   * Unlike getEffective(), does NOT fall back to the schema default — used
   * by the internal AI-config sync to distinguish "admin explicitly chose
   * this model" from "no override, keep the AI service's own env default"
   * even though those can coincidentally be the same string.
   */
  async getIfOverridden(key: string): Promise<string | null> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return row ? row.value : null;
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
   *
   * `secret` fields never put the real value (encrypted or not) on the wire —
   * `value` is always "" and `configured`/`preview` communicate state instead.
   * The frontend's dirty-tracking already treats "" as the baseline, so
   * typing a new key is what marks the field dirty, not the masked display.
   */
  async listAll(): Promise<SettingRow[]> {
    const rows = await this.prisma.appSetting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    return this.definitions.map((d) => {
      const stored = byKey.get(d.key);
      if (d.type === 'secret') {
        const configured = stored !== undefined && stored !== '';
        let preview: string | undefined;
        if (configured) {
          try {
            const real = this.decryptSecret(stored!);
            preview = `••••${real.length > 4 ? real.slice(-4) : real}`;
          } catch {
            preview = undefined;
          }
        }
        return { ...d, value: '', overridden: configured, configured, preview };
      }
      return { ...d, value: stored ?? d.default, overridden: stored !== undefined };
    });
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
      const stored = def.type === 'secret' ? this.encryptSecret(value) : value;
      await this.prisma.appSetting.upsert({
        where: { key },
        create: { key, value: stored },
        update: { value: stored },
      });
      if (def.type === 'secret') {
        // Audit trail for credential changes — key name and length only,
        // never the value itself, in application logs or anywhere else.
        this.logger.log(`Secret setting "${key}" updated (${value.length} chars).`);
      }
      // Echoed back in the response as confirmation of what was applied —
      // the plaintext the admin just typed, not what's now stored encrypted.
      applied.push({ key, value: def.type === 'secret' ? '••••••••' : value });
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
      case 'secret':
        return value.trim().length >= 10
          ? null
          : 'That looks too short for a real API key — check you copied the full value.';
      case 'order': {
        const known = new Set((def.options ?? []).map((o) => o.value));
        const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length === 0) {
          return 'Enable at least one provider — otherwise no AI features can run.';
        }
        const unknown = parts.filter((p) => !known.has(p));
        if (unknown.length) return `Unknown option(s): ${unknown.join(', ')}.`;
        if (new Set(parts).size !== parts.length) return 'Each option may appear only once.';
        return null;
      }
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