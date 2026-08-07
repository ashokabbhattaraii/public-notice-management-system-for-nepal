import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../services/users.service';
import { JwtPayload } from '../services/auth.service';
import { extractToken, SESSION_COOKIE } from '../common/auth-token';

/**
 * Accept the session token from either the Authorization header or the
 * `pnm_token` httpOnly cookie set at login. The cookie path lets a browser
 * ride on a pure cookie session (no JS-visible secret), while scripts keep
 * using the header.
 */
const cookieExtractor = (req: any): string | null => {
  const token = extractToken(req);
  if (token) return token;
  // extractToken already covers both; keep SESSION_COOKIE referenced for
  // discoverability of the cookie name used by this strategy.
  void SESSION_COOKIE;
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  // Re-load the user from the DB so role/status changes are enforced per request.
  async validate(payload: JwtPayload) {
    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException();
    }
    return user;
  }
}