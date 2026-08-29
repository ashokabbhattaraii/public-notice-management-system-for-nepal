import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiProvider, AiProviderKind } from '@prisma/client';
import * as dns from 'dns/promises';
import * as net from 'net';
import { PrismaService } from '../prisma/prisma.service';
import { SecretCryptoService } from '../common/crypto/secret-crypto.service';

/** Shape sent to the admin UI — never contains a decrypted key. */
export interface AiProviderView {
  id: string;
  slug: string;
  label: string;
  kind: AiProviderKind;
  baseUrl: string | null;
  model: string;
  enabled: boolean;
  sortOrder: number;
  isBuiltIn: boolean;
  /** True when a key is stored here (as opposed to falling back to env). */
  configured: boolean;
  /** Masked last-4 preview, e.g. "••••8i30". */
  preview?: string;
}

export interface UpsertProviderInput {
  label?: string;
  kind?: AiProviderKind;
  baseUrl?: string | null;
  model?: string;
  apiKey?: string;
  enabled?: boolean;
}

/**
 * The provider registry behind /admin/ai. Built-ins are seeded rows, so an
 * admin-added provider is not a second-class citizen — same edit, reorder,
 * health-check and delete paths.
 */
@Injectable()
export class AiProvidersService implements OnModuleInit {
  private readonly logger = new Logger(AiProvidersService.name);

  // Seeded once so the registry is never empty on a fresh install. Values
  // mirror the AI service's own env defaults; keys stay null so an existing
  // env-var-configured deployment keeps working untouched until an admin
  // explicitly sets one here.
  private static readonly BUILT_INS: Array<
    Pick<AiProvider, 'slug' | 'label' | 'kind' | 'baseUrl' | 'model' | 'sortOrder'>
  > = [
    {
      slug: 'gemini',
      label: 'Google Gemini',
      kind: AiProviderKind.GEMINI,
      baseUrl: null,
      model: 'gemini-3.6-flash',
      sortOrder: 0,
    },
    {
      slug: 'groq',
      label: 'Groq',
      kind: AiProviderKind.OPENAI_COMPATIBLE,
      baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
      model: 'openai/gpt-oss-120b',
      sortOrder: 1,
    },
    {
      slug: 'opencode',
      label: 'OpenCode Zen',
      kind: AiProviderKind.OPENAI_COMPATIBLE,
      baseUrl: 'https://opencode.ai/zen/v1/chat/completions',
      model: 'deepseek-v4-flash-free',
      sortOrder: 2,
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: SecretCryptoService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const count = await this.prisma.aiProvider.count();
    if (count > 0) return;
    await this.prisma.aiProvider.createMany({
      data: AiProvidersService.BUILT_INS.map((p) => ({ ...p, isBuiltIn: true })),
      skipDuplicates: true,
    });
    this.logger.log(`Seeded ${AiProvidersService.BUILT_INS.length} built-in AI providers`);
  }

  // ── URL safety ─────────────────────────────────────────────────────────
  //
  // A custom provider means an admin types a URL this server will POST an API
  // key to. Even behind an admin-only route that is an SSRF primitive, so the
  // endpoint must be public HTTPS — or a host explicitly allowlisted by the
  // operator via env (for a self-hosted vLLM/Ollama box).

  private allowlistedHosts(): string[] {
    return (this.config.get<string>('AI_PROVIDER_ALLOWED_HOSTS') ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
  }

  private async assertSafeEndpoint(rawUrl: string): Promise<void> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestException('Endpoint must be a valid URL.');
    }

    const host = parsed.hostname.toLowerCase();
    const allowlisted = this.allowlistedHosts().includes(host);

    // An allowlisted host is a deliberate operator decision, so it may use
    // http and may resolve privately — that is the entire point of the list.
    if (allowlisted) return;

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException(
        'Endpoint must use https. To use an internal or plain-http host, add it to AI_PROVIDER_ALLOWED_HOSTS on the server.',
      );
    }

    let addresses: string[];
    try {
      addresses = (await dns.lookup(host, { all: true })).map((r) => r.address);
    } catch {
      throw new BadRequestException(`Could not resolve "${host}".`);
    }
    if (addresses.some((a) => this.isPrivateAddress(a))) {
      throw new BadRequestException(
        `"${host}" resolves to a private address. Add it to AI_PROVIDER_ALLOWED_HOSTS if this is intentional.`,
      );
    }
  }

  /** Mirrors AttachmentsController's guard — RFC1918, loopback, link-local, metadata. */
  private isPrivateAddress(address: string): boolean {
    if (net.isIPv4(address)) {
      const [a, b] = address.split('.').map(Number);
      return (
        a === 10 ||
        a === 127 ||
        a === 0 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168)
      );
    }
    const lower = address.toLowerCase();
    return (
      lower === '::1' ||
      lower.startsWith('fc') ||
      lower.startsWith('fd') ||
      lower.startsWith('fe80')
    );
  }

  // ── Reads ──────────────────────────────────────────────────────────────

  private toView(p: AiProvider): AiProviderView {
    return {
      id: p.id,
      slug: p.slug,
      label: p.label,
      kind: p.kind,
      baseUrl: p.baseUrl,
      model: p.model,
      enabled: p.enabled,
      sortOrder: p.sortOrder,
      isBuiltIn: p.isBuiltIn,
      configured: Boolean(p.apiKeyEnc),
      preview: p.apiKeyEnc ? this.crypto.preview(p.apiKeyEnc) : undefined,
    };
  }

  async list(): Promise<AiProviderView[]> {
    const rows = await this.prisma.aiProvider.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map((r) => this.toView(r));
  }

  /**
   * Full config including DECRYPTED keys, for the AI service only. Never
   * reachable from a user-facing route — see InternalAiConfigController.
   */
  async listForRuntime() {
    const rows = await this.prisma.aiProvider.findMany({ orderBy: { sortOrder: 'asc' } });
    return rows.map((r) => ({
      slug: r.slug,
      label: r.label,
      kind: r.kind,
      baseUrl: r.baseUrl,
      model: r.model,
      enabled: r.enabled,
      apiKey: r.apiKeyEnc ? this.safeDecrypt(r.apiKeyEnc, r.slug) : null,
    }));
  }

  private safeDecrypt(value: string, slug: string): string | null {
    try {
      return this.crypto.decrypt(value);
    } catch (e: any) {
      this.logger.warn(`Could not decrypt API key for provider "${slug}": ${e.message}`);
      return null;
    }
  }

  async findOne(id: string): Promise<AiProvider> {
    const row = await this.prisma.aiProvider.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Provider not found');
    return row;
  }

  // ── Writes ─────────────────────────────────────────────────────────────

  async create(input: UpsertProviderInput & { label: string; kind: AiProviderKind; model: string }) {
    if (!input.label?.trim()) throw new BadRequestException('Name is required.');
    if (!input.model?.trim()) throw new BadRequestException('Model is required.');

    if (input.kind === AiProviderKind.OPENAI_COMPATIBLE) {
      if (!input.baseUrl?.trim()) {
        throw new BadRequestException('Endpoint URL is required for OpenAI-compatible providers.');
      }
      await this.assertSafeEndpoint(input.baseUrl);
    }

    const slug = await this.uniqueSlug(input.label);
    const last = await this.prisma.aiProvider.findFirst({ orderBy: { sortOrder: 'desc' } });

    const created = await this.prisma.aiProvider.create({
      data: {
        slug,
        label: input.label.trim(),
        kind: input.kind,
        // Gemini derives its URL from the model, so any value here is noise.
        baseUrl: input.kind === AiProviderKind.GEMINI ? null : input.baseUrl!.trim(),
        model: input.model.trim(),
        apiKeyEnc: input.apiKey ? this.crypto.encrypt(input.apiKey) : null,
        enabled: input.enabled ?? true,
        sortOrder: (last?.sortOrder ?? -1) + 1,
        isBuiltIn: false,
      },
    });
    this.logger.log(`AI provider created: ${created.slug} (${created.kind})`);
    return this.toView(created);
  }

  async update(id: string, input: UpsertProviderInput) {
    const existing = await this.findOne(id);
    const kind = input.kind ?? existing.kind;

    let baseUrl = input.baseUrl === undefined ? existing.baseUrl : input.baseUrl;
    if (kind === AiProviderKind.GEMINI) {
      baseUrl = null;
    } else if (baseUrl) {
      // Re-validate on every change: an allowlist edit or DNS change can make
      // a previously-accepted host unsafe.
      if (baseUrl !== existing.baseUrl) await this.assertSafeEndpoint(baseUrl);
    } else {
      throw new BadRequestException('Endpoint URL is required for OpenAI-compatible providers.');
    }

    const updated = await this.prisma.aiProvider.update({
      where: { id },
      data: {
        // Built-in slugs are immutable so ordering/health stay stable, but
        // their label, model, key and endpoint are all editable.
        label: input.label?.trim() ?? existing.label,
        kind,
        baseUrl,
        model: input.model?.trim() ?? existing.model,
        enabled: input.enabled ?? existing.enabled,
        ...(input.apiKey !== undefined
          ? { apiKeyEnc: input.apiKey ? this.crypto.encrypt(input.apiKey) : null }
          : {}),
      },
    });
    if (input.apiKey !== undefined) {
      // Audit trail: name and length only, never the value.
      this.logger.log(
        input.apiKey
          ? `API key updated for provider "${updated.slug}" (${input.apiKey.length} chars)`
          : `API key cleared for provider "${updated.slug}"`,
      );
    }
    return this.toView(updated);
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    if (existing.isBuiltIn) {
      throw new BadRequestException(
        'Built-in providers cannot be deleted — disable it instead, which stops it being called at all.',
      );
    }
    await this.prisma.aiProvider.delete({ where: { id } });
    this.logger.log(`AI provider deleted: ${existing.slug}`);
    return { id, deleted: true };
  }

  /** Persist a new fallback chain. `ids` is the full list, in display order. */
  async reorder(ids: string[]) {
    const rows = await this.prisma.aiProvider.findMany({ select: { id: true } });
    const known = new Set(rows.map((r) => r.id));
    const unknown = ids.filter((id) => !known.has(id));
    if (unknown.length) throw new BadRequestException('Unknown provider id in ordering.');
    if (ids.length !== rows.length) {
      throw new BadRequestException('Ordering must include every provider exactly once.');
    }

    await this.prisma.$transaction(
      ids.map((id, index) =>
        this.prisma.aiProvider.update({ where: { id }, data: { sortOrder: index } }),
      ),
    );
    return this.list();
  }

  private async uniqueSlug(label: string): Promise<string> {
    const base =
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'provider';
    let candidate = base;
    for (let n = 2; ; n++) {
      const clash = await this.prisma.aiProvider.findUnique({ where: { slug: candidate } });
      if (!clash) return candidate;
      candidate = `${base}-${n}`;
    }
  }
}
