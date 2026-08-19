import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { EvolutionApiService } from '../integrations/evolution/evolution-api.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Admin-only control panel for the single shared Evolution API sender
 * instance (as opposed to NotificationsController, which manages each
 * individual user's opt-in phone number against that same instance).
 * Lets an admin see whether the sender number is connected, pull a fresh QR
 * to link a different number, and force-logout the current session.
 */
@Controller('admin/whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.admin)
export class AdminWhatsappController {
  constructor(
    private readonly evolutionApi: EvolutionApiService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  async status() {
    const configured = this.evolutionApi.isConfigured();
    const live = configured ? await this.evolutionApi.getConnectionState() : null;
    const cached = await this.prisma.appSetting.findUnique({ where: { key: 'whatsapp.connectionState' } });
    return {
      configured,
      // "open" = connected and able to send. Falls back to the last webhook-
      // reported state if the live poll to Evolution API fails.
      state: live?.instance?.state ?? live?.state ?? cached?.value ?? 'unknown',
    };
  }

  @Post('qr')
  async qr() {
    const qr = await this.evolutionApi.getQrCode();
    if (!qr) return { available: false };
    return { available: true, base64: qr.base64 ?? null, pairingCode: qr.pairingCode ?? null };
  }

  @Post('logout')
  async logout() {
    const ok = await this.evolutionApi.logout();
    return { loggedOut: ok };
  }
}
