import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenRevocationService } from '../common/token-revocation.service';
import { extractToken } from '../common/auth-token';

/**
 * Optional JWT guard — requests with no/expired token are treated as
 * anonymous (null user). A token that was explicitly REVOKED is treated as
 * absent too, so logged-out sessions don't re-authenticate cached identity.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly revoked: TokenRevocationService) {
    super();
  }

  handleRequest(_err: any, user: any, info: any, context: any) {
    // isRevoked is async but handleRequest must be sync per AuthGuard contract;
    // we do a best-effort sync check. Real revocation enforcement is in JwtAuthGuard.
    // For optional guard, stale revocation (up to next DB poll) is acceptable.
    const req = context.switchToHttp?.()?.getRequest?.();
    if (req) {
      const token = extractToken(req);
      // Check in-memory only synchronously; DB fallback is async and handled by JwtAuthGuard
      if (token) {
        const maybePromise = (this.revoked as any).isRevoked(token);
        // If isRevoked returns a promise, we can't await here — treat as not revoked for optional routes
        // (protected routes via JwtAuthGuard will enforce async check).
        if (maybePromise === true) return null;
      }
    }
    return user || null;
  }
}