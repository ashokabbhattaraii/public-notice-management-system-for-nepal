import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * In-memory JWT revocation store.
 *
 * Logging out marks the current token revoked so it stops working immediately
 * (a stolen/old copy that never leaves the client is then worthless). Relies
 * on the JWT `exp` claim to prune entries, so memory stays bounded even at
 * high logout volume.
 *
 * Single-process assumption: this API runs one Nest instance. On restart the
 * store empties — but the issued tokens are short-lived (JWT_EXPIRES_IN), so
 * the blast radius stays small.
 */
@Injectable()
export class TokenRevocationService {
  private readonly revoked = new Map<string, number>(); // sha256(token) -> exp ms

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private expiryOf(token: string): number {
    // Best-effort payload decode for the `exp` claim; fall back to 24h so a
    // malformed-but-previously-valid token still gets pruned eventually.
    try {
      const [, body] = token.split('.');
      const pad = body.replace(/-/g, '+').replace(/_/g, '/');
      const json = Buffer.from(pad + '='.repeat((4 - (pad.length % 4)) % 4), 'base64').toString('utf8');
      const exp = JSON.parse(json).exp as number | undefined;
      if (typeof exp === 'number' && Number.isFinite(exp)) return exp * 1000;
    } catch {
      // ignore
    }
    return Date.now() + 24 * 60 * 60 * 1000;
  }

  /** Mark a token unusable from now on. */
  revoke(token: string): void {
    const at = Date.now();
    this.prune(at);
    this.revoked.set(this.hash(token), this.expiryOf(token));
  }

  isRevoked(token: string): boolean {
    const exp = this.revoked.get(this.hash(token));
    if (!exp) return false;
    if (exp <= Date.now()) {
      this.revoked.delete(this.hash(token));
      return false;
    }
    return true;
  }

  private prune(now: number): void {
    for (const [key, exp] of this.revoked) {
      if (exp <= now) this.revoked.delete(key);
    }
  }

  /** Number of live revoked tokens (diagnostics only). */
  size(): number {
    return this.revoked.size;
  }
}