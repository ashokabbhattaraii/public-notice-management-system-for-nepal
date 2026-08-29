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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ContactMessageStatus, Role } from '@prisma/client';
import { Request } from 'express';
import { ContactService } from '../services/contact.service';
import { CreateContactMessageDto } from '../dto/create-contact-message.dto';
import { UpdateContactMessageDto } from '../dto/update-contact-message.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

function clientMeta(req: Request): { ip?: string; userAgent?: string } {
  const forwarded = req.headers['x-forwarded-for'];
  const ip =
    (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ??
    req.ip ??
    (req.socket?.remoteAddress as string | undefined);
  const userAgent = req.headers['user-agent'] as string | undefined;
  return { ip, userAgent: userAgent?.slice(0, 1000) };
}

@ApiTags('contact')
@Controller()
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  /** Public — no auth. Rate-limited inside the service. */
  @Post('contact')
  @ApiOperation({ summary: 'Submit a contact message' })
  async submit(@Body() dto: CreateContactMessageDto, @Req() req: Request) {
    const result = await this.contact.create(dto, clientMeta(req));
    return { ok: true, ...result, message: "Thanks — we'll get back within one business day." };
  }
}

@ApiTags('admin-contact')
@Controller('admin/contact-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class AdminContactController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  @ApiOperation({ summary: 'List contact messages (admin)' })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    const parsedStatus =
      status && Object.values(ContactMessageStatus).includes(status as ContactMessageStatus)
        ? (status as ContactMessageStatus)
        : undefined;
    const so = sortOrder === 'asc' ? 'asc' : 'desc';
    return this.contact.list({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      status: parsedStatus,
      search,
      sortOrder: so,
    });
  }

  @Get('counts')
  @ApiOperation({ summary: 'Counts by status (admin)' })
  async counts() {
    return this.contact.counts();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update contact message status (admin)' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateContactMessageDto) {
    if (!dto.status) return this.contact.list({ page: 1, limit: 1 });
    return this.contact.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a contact message (admin)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.contact.delete(id);
  }
}
