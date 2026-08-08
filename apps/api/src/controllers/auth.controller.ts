import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { User } from '@prisma/client';
import { AuthService } from '../services/auth.service';
import { CurrentUser } from '../decorators/current-user.decorator';
import { GoogleLoginDto } from '../dto/google-login.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { TokenRevocationService } from '../common/token-revocation.service';
import { extractToken, SESSION_COOKIE } from '../common/auth-token';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly revoked: TokenRevocationService,
  ) {}

  // Exchange a Google ID token for an app session JWT. The token is also set
  // as an httpOnly cookie so the browser can authenticate on the cookie alone.
  @Post('google')
  async google(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.loginWithGoogle(dto.credential);
    res.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // must mirror JWT_EXPIRES_IN
    });
    return result;
  }

  // Revoke the current session server-side and drop the session cookie.
  // Idempotent: safe to call without a valid session (client logout cleanup).
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    const token = extractToken(res.req as any);
    if (token) {
      this.revoked.revoke(token);
    }
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  // Return the currently authenticated user.
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: User) {
    return this.auth.toPublicUser(user);
  }

  // Example of an admin-only endpoint guarded by role.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin/ping')
  adminPing() {
    return { ok: true, scope: 'admin' };
  }
}