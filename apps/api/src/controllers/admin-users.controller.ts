import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UsersService } from '../services/users.service';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';

function toPublicUser(u: any) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatarUrl,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastLoginAt: u.lastLoginAt,
    subscription: u.subscription ?? null,
    documentsCount: u._count?.documents ?? undefined,
    alertRulesCount: u._count?.alertRules ?? undefined,
    // raw googleId is never exposed — internal only.
  };
}

@ApiTags('admin-users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users (paginated, searchable)' })
  async listUsers(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const parsedRole =
      role && Object.values(Role).includes(role as Role) ? (role as Role) : undefined;
    const parsedStatus =
      status && Object.values(UserStatus).includes(status as UserStatus)
        ? (status as UserStatus)
        : undefined;
    const allowedSort = new Set(['createdAt', 'lastLoginAt', 'name', 'email']);
    const sb = allowedSort.has(sortBy ?? '') ? (sortBy as any) : 'createdAt';
    const so = sortOrder === 'asc' ? 'asc' : 'desc';

    const result = await this.users.listAdminUsers({
      search,
      role: parsedRole,
      status: parsedStatus,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      sortBy: sb,
      sortOrder: so,
    });
    return {
      data: result.data.map(toPublicUser),
      meta: result.meta,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one user by id' })
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.users.getAdminUserById(id);
    return toPublicUser(row);
  }

  @Post()
  @ApiOperation({ summary: 'Create a user (placeholder for Google linking)' })
  async createUser(@Body() dto: CreateAdminUserDto) {
    const user = await this.users.adminCreateUser(dto);
    // Return mapped public shape
    return toPublicUser({
      ...user,
      _count: { documents: 0, alertRules: 0 },
      subscription: null,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (role, status, name, email)' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser() actor: { id: string },
  ) {
    const updated = await this.users.adminUpdateUser(id, dto, actor.id);
    return toPublicUser({
      ...updated,
      _count: undefined,
      subscription: undefined,
    });
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  async deleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: { id: string },
  ) {
    await this.users.adminDeleteUser(id, actor.id);
    return { deleted: true, id };
  }
}
