import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { User } from '@prisma/client';
import { UsersService } from './users.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;
  private readonly googleClientId: string;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.googleClientId = config.get<string>('GOOGLE_CLIENT_ID') ?? '';
    if (!this.googleClientId) {
      throw new InternalServerErrorException(
        'GOOGLE_CLIENT_ID is not configured',
      );
    }
    this.googleClient = new OAuth2Client(this.googleClientId);
  }

  /**
   * Verify the Google ID token server-side, upsert the user, and mint our own
   * stateless JWT session token.
   */
  async loginWithGoogle(credential: string) {
    const payload = await this.verifyGoogleCredential(credential);

    const user = await this.users.upsertFromGoogle({
      googleId: payload.sub!,
      email: payload.email!,
      name: payload.name ?? payload.email!,
      avatarUrl: payload.picture ?? null,
    });

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account is disabled');
    }

    return {
      token: await this.signToken(user),
      user: this.toPublicUser(user),
    };
  }

  private async verifyGoogleCredential(credential: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: this.googleClientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new Error('Token missing required claims');
      }
      if (payload.email_verified === false) {
        throw new Error('Email not verified by Google');
      }
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }
  }

  private signToken(user: User): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwt.signAsync(payload);
  }

  toPublicUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
