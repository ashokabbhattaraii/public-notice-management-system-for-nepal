import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TokenRevocationService } from '../common/token-revocation.service';
import { extractToken } from '../common/auth-token';

/**
 * Standard JWT guard with a hard requirement: the token must exist, be
 * structurally valid, signed, unexpired, and NOT revoked server-side (i.e. the
 * user clicked "logout" — that token stays dead even if replayed).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly revoked: TokenRevocationService) {
    super();
  }

  async canActivate(context: any) {
    const req = context.switchToHttp().getRequest();
    const token = extractToken(req);
    if (token && this.revoked.isRevoked(token)) {
      throw new UnauthorizedException('Session was revoked — sign in again');
    }
    return (await super.canActivate(context)) as boolean;
  }
}