import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

@Injectable()
export class UsersService {
  private readonly adminEmails: Set<string>;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    // ADMIN_EMAILS is a comma-separated allowlist; matching emails get the admin role.
    this.adminEmails = new Set(
      (config.get<string>('ADMIN_EMAILS') ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  resolveRole(email: string): Role {
    return this.adminEmails.has(email.toLowerCase()) ? Role.admin : Role.user;
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /**
   * Create the user on first Google sign-in, or update their profile on return.
   * Role is always re-derived from the ADMIN_EMAILS allowlist so promotions/
   * demotions take effect on the next login without a DB migration.
   */
  upsertFromGoogle(profile: GoogleProfile): Promise<User> {
    const email = profile.email.toLowerCase();
    const role = this.resolveRole(email);
    const avatarUrl = profile.avatarUrl ?? null;

    return this.prisma.user.upsert({
      where: { googleId: profile.googleId },
      create: {
        googleId: profile.googleId,
        email,
        name: profile.name,
        avatarUrl,
        role,
        lastLoginAt: new Date(),
      },
      update: {
        email,
        name: profile.name,
        avatarUrl,
        role,
        lastLoginAt: new Date(),
      },
    });
  }
}
