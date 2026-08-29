import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role, User, UserStatus } from '@prisma/client';
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

  async getAdminUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        _count: { select: { documents: true, alertRules: true } },
        subscription: {
          select: { status: true, plan: { select: { tier: true, name: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async listAdminUsers(params: {
    search?: string;
    role?: Role;
    status?: UserStatus;
    page?: number;
    limit?: number;
    sortBy?: 'createdAt' | 'lastLoginAt' | 'name' | 'email';
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(Math.max(1, params.limit ?? 20), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};
    if (params.search) {
      const q = params.search.trim();
      if (q) {
        where.OR = [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ];
      }
    }
    if (params.role) where.role = params.role;
    if (params.status) where.status = params.status;

    const sortBy = params.sortBy ?? 'createdAt';
    const sortOrder = params.sortOrder ?? 'desc';
    const orderBy: Prisma.UserOrderByWithRelationInput =
      sortBy === 'lastLoginAt'
        ? { lastLoginAt: sortOrder }
        : sortBy === 'name'
          ? { name: sortOrder }
          : sortBy === 'email'
            ? { email: sortOrder }
            : { createdAt: sortOrder };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          googleId: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          _count: { select: { documents: true, alertRules: true } },
          subscription: {
            select: {
              status: true,
              plan: { select: { tier: true, name: true } },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async adminCreateUser(input: {
    email: string;
    name: string;
    role?: Role;
    status?: UserStatus;
  }): Promise<User> {
    const email = input.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException(`A user with email ${email} already exists`);
    }
    const role = input.role ?? this.resolveRole(email);
    const status = input.status ?? UserStatus.active;
    // Dummy googleId that will be replaced when the real Google account signs in.
    const googleId = `manual:${email}:${Date.now()}`;
    return this.prisma.user.create({
      data: {
        googleId,
        email,
        name: input.name.trim(),
        role,
        status,
      },
    });
  }

  async adminUpdateUser(
    id: string,
    patch: { email?: string; name?: string; role?: Role; status?: UserStatus },
    actorId?: string,
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Guard self-demotion / self-disable / self-role-strip so an admin can't lock themselves out.
    if (actorId && actorId === id) {
      if (patch.role && patch.role !== user.role) {
        throw new BadRequestException('You cannot change your own role');
      }
      if (patch.status && patch.status !== user.status && patch.status === UserStatus.inactive) {
        throw new BadRequestException('You cannot deactivate your own account');
      }
    }

    const data: Prisma.UserUpdateInput = {};
    if (patch.name !== undefined) {
      const n = patch.name.trim();
      if (!n) throw new BadRequestException('Name cannot be empty');
      data.name = n;
    }
    if (patch.email !== undefined) {
      const email = patch.email.toLowerCase().trim();
      if (email !== user.email) {
        const clash = await this.prisma.user.findUnique({ where: { email } });
        if (clash) throw new BadRequestException(`A user with email ${email} already exists`);
        data.email = email;
        // Keep role in sync with ADMIN_EMAILS when email changes, unless role is explicitly patched.
        if (patch.role === undefined) {
          data.role = this.resolveRole(email);
        }
      }
    }
    if (patch.role !== undefined) data.role = patch.role;
    if (patch.status !== undefined) data.status = patch.status;

    if (Object.keys(data).length === 0) return user;

    return this.prisma.user.update({ where: { id }, data });
  }

  async adminDeleteUser(id: string, actorId?: string): Promise<void> {
    if (actorId && actorId === id) {
      throw new BadRequestException('You cannot delete your own account');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // Documents block cascade (no onDelete). Null out ownership first so the
    // delete isn't blocked by the foreign key.
    await this.prisma.$transaction([
      this.prisma.document.updateMany({
        where: { uploadedBy: id },
        data: { uploadedBy: null },
      }),
      // Upcoming cascade deletions (alertRules, usage etc) are handled by Prisma,
      // but we clean manually for safety where needed.
      this.prisma.user.delete({ where: { id } }),
    ]);
  }

  /**
   * Create the user on first Google sign-in, or update their profile on return.
   * Role is always re-derived from the ADMIN_EMAILS allowlist so promotions/
   * demotions take effect on the next login without a DB migration.
   *
   * If an admin previously created a placeholder user with the same email
   * (googleId = manual:*), this links the real Google subject to that row
   * instead of failing on the email unique constraint.
   */
  async upsertFromGoogle(profile: GoogleProfile): Promise<User> {
    const email = profile.email.toLowerCase();
    const role = this.resolveRole(email);
    const avatarUrl = profile.avatarUrl ?? null;

    // Fast path: exact googleId match.
    const existingByGoogle = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });
    if (existingByGoogle) {
      return this.prisma.user.update({
        where: { id: existingByGoogle.id },
        data: {
          email,
          name: profile.name,
          avatarUrl,
          role,
          lastLoginAt: new Date(),
          status: UserStatus.active,
        },
      });
    }

    // Placeholder linking: admin created a manual user with this email.
    const existingByEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingByEmail) {
      // If the existing row is a manual placeholder, adopt its id and replace googleId.
      // Even for non-manual collisions, linking by email is the desired behaviour
      // (one email == one account). The original googleId would otherwise cause
      // a duplicate-email error on create.
      return this.prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId: profile.googleId,
          name: profile.name,
          avatarUrl,
          role,
          lastLoginAt: new Date(),
          status: UserStatus.active,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        googleId: profile.googleId,
        email,
        name: profile.name,
        avatarUrl,
        role,
        lastLoginAt: new Date(),
      },
    });
  }
}
