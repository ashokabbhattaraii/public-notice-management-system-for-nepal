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
    const req = context.switchToHttp?.()?.getRequest?.();
    if (req) {
      const token = extractToken(req);
      if (token && this.revoked.isRevoked(token)) return null;
    }
    return user || null;
  }
}