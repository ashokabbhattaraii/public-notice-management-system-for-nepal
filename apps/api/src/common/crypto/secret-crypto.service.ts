import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * AES-256-GCM encryption for admin-managed secrets at rest (LLM provider API
 * keys, and the `secret`-typed rows in app_settings).
 *
 * Format: "v1:<iv>:<tag>:<ciphertext>", each part base64. Everything lands in
 * an ordinary text column, so no schema type changes are needed. GCM's auth
 * tag means a tampered or key-mismatched row fails loudly on read instead of
 * silently decrypting to garbage.
 *
 * NOTE: SETTINGS_ENCRYPTION_KEY is load-bearing — rotating it orphans every
 * previously-stored secret. See apps/api/.env.example.
 */
@Injectable()
export class SecretCryptoService {
  constructor(private readonly config: ConfigService) {}

  /** True when the server can encrypt/decrypt at all. */
  get isConfigured(): boolean {
    return Boolean(this.config.get<string>('SETTINGS_ENCRYPTION_KEY'));
  }

  private key(): Buffer {
    const raw = this.config.get<string>('SETTINGS_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error(
        'SETTINGS_ENCRYPTION_KEY is not configured on this server — cannot store or read secrets.',
      );
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error('SETTINGS_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    }
    return key;
  }

  encrypt(plain: string): string {
    const key = this.key();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      'v1',
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(stored: string): string {
    const [version, ivB64, tagB64, dataB64] = stored.split(':');
    if (version !== 'v1' || !ivB64 || !tagB64 || !dataB64) {
      throw new Error('Unrecognized secret encoding.');
    }
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.key(),
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** Never returns the value — only a last-4 preview for the admin UI. */
  preview(stored: string): string | undefined {
    try {
      const real = this.decrypt(stored);
      return `••••${real.length > 4 ? real.slice(-4) : real}`;
    } catch {
      return undefined;
    }
  }
}
