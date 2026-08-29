import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { EmailChannelService } from '../services/email-channel.service';
import { UpdateEmailChannelDto } from '../dto/update-email-channel.dto';

/**
 * Admin configuration for the two alert delivery channels: email (SMTP,
 * configured here) and WhatsApp (the shared Evolution API sender, whose
 * connection lifecycle lives in AdminWhatsappController).
 *
 * Admin-only, and deliberately asymmetric about secrets: the SMTP password
 * can be written but never read back — GET returns `passwordConfigured` and
 * a masked preview, so a stolen admin session cannot exfiltrate a working
 * credential, only overwrite it (which is visible in the audit log).
 */
@Controller('admin/alert-channels')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class AlertChannelsController {
  constructor(private readonly email: EmailChannelService) {}

  @Get('email')
  getEmail() {
    return this.email.getConfig();
  }

  @Put('email')
  updateEmail(@CurrentUser() user: User, @Body() dto: UpdateEmailChannelDto) {
    return this.email.update({ id: user.id, email: user.email }, dto);
  }

  /**
   * Sends to the admin's own account email only — the recipient is taken
   * from the JWT-backed user, never from the request body.
   */
  @Post('email/test')
  testEmail(@CurrentUser() user: User) {
    return this.email.sendTest({ id: user.id, email: user.email });
  }
}
