import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { DigestFrequency } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QuotaService } from './quota.service';
import { EvolutionApiService } from '../integrations/evolution/evolution-api.service';

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_COOLDOWN_MS = 60 * 1000;

export interface WhatsappStatus {
  connected: boolean;
  alertsEnabled: boolean;
  phoneNumberMasked: string | null;
  digestFrequency: DigestFrequency;
}

/**
 * WhatsApp channel management for the currently authenticated user: register
 * + OTP-verify a phone number against the single shared Evolution API
 * instance, then toggle whether AlertRule matches are delivered to it.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evolutionApi: EvolutionApiService,
    private readonly quota: QuotaService,
  ) {}

  async getStatus(userId: string): Promise<WhatsappStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      connected: user.whatsappVerified,
      alertsEnabled: user.whatsappAlertsEnabled,
      phoneNumberMasked: user.whatsappVerified ? this.mask(user.whatsappNumber) : null,
      digestFrequency: user.digestFrequency,
    };
  }

  async setDigestFrequency(userId: string, digestFrequency: DigestFrequency): Promise<WhatsappStatus> {
    // Instant delivery is a paid feature. Rejecting the save (rather than
    // silently storing a cadence the sender would ignore) keeps the settings
    // screen honest about what the user is actually getting.
    if (digestFrequency === DigestFrequency.INSTANT) {
      await this.quota.assertCanUseInstantAlerts(userId);
    }
    await this.prisma.user.update({ where: { id: userId }, data: { digestFrequency } });
    return this.getStatus(userId);
  }

  async requestOtp(userId: string, rawPhoneNumber: string): Promise<{ requested: true }> {
    const phoneNumber = this.normalize(rawPhoneNumber);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (user.whatsappOtpRequestedAt && Date.now() - user.whatsappOtpRequestedAt.getTime() < OTP_COOLDOWN_MS) {
      throw new BadRequestException('Please wait a minute before requesting another code');
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    const codeHash = this.hash(code);
    const now = new Date();

    const sent = await this.evolutionApi.sendText(
      phoneNumber,
      `Your public-notice-management WhatsApp verification code is ${code}. It expires in 10 minutes.`,
    );
    if (!sent) {
      throw new BadRequestException('Could not send a WhatsApp message to that number — double-check it and try again');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        whatsappPendingNumber: phoneNumber,
        whatsappOtpCode: codeHash,
        whatsappOtpExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
        whatsappOtpRequestedAt: now,
      },
    });

    return { requested: true };
  }

  async verifyOtp(userId: string, code: string): Promise<WhatsappStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    if (!user.whatsappPendingNumber || !user.whatsappOtpCode || !user.whatsappOtpExpiresAt) {
      throw new BadRequestException('No verification in progress — request a code first');
    }
    if (user.whatsappOtpExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('That code has expired — request a new one');
    }
    if (user.whatsappOtpCode !== this.hash(code)) {
      throw new BadRequestException('Incorrect code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        whatsappNumber: user.whatsappPendingNumber,
        whatsappVerified: true,
        whatsappPendingNumber: null,
        whatsappOtpCode: null,
        whatsappOtpExpiresAt: null,
        whatsappOtpRequestedAt: null,
      },
    });

    return this.getStatus(userId);
  }

  async toggleAlerts(userId: string, enabled: boolean): Promise<WhatsappStatus> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (enabled && !user.whatsappVerified) {
      throw new BadRequestException('Verify a WhatsApp number before enabling alerts');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { whatsappAlertsEnabled: enabled } });
    return this.getStatus(userId);
  }

  async disconnect(userId: string): Promise<WhatsappStatus> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        whatsappNumber: null,
        whatsappVerified: false,
        whatsappAlertsEnabled: false,
        whatsappPendingNumber: null,
        whatsappOtpCode: null,
        whatsappOtpExpiresAt: null,
        whatsappOtpRequestedAt: null,
      },
    });
    return this.getStatus(userId);
  }

  private normalize(raw: string): string {
    return raw.replace(/[^0-9]/g, '');
  }

  private hash(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  private mask(number: string | null): string | null {
    if (!number) return null;
    return number.length <= 4 ? '••••' : `${'•'.repeat(number.length - 4)}${number.slice(-4)}`;
  }
}
