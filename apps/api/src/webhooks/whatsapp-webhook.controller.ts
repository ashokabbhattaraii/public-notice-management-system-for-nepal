import { Controller, Post, Logger, Body, Headers } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Passive receiver for Evolution API instance events (set via
 * POST /webhook/set/:instanceName on the Evolution API side). We only care
 * about connection lifecycle here — inbound chat messages are not acted on;
 * this app sends alerts one-way, it isn't a chatbot.
 */
@Controller('webhooks')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Post('whatsapp')
  async handleWebhook(
    @Body() body: any,
    @Headers('x-instance-name') instanceName: string,
  ) {
    if (!body || !body.event) {
      this.logger.warn('Empty or invalid webhook body received');
      return { received: false };
    }
    this.logger.log(`Webhook received: ${body.event} from instance: ${instanceName}`);

    switch (body.event) {
      case 'connection.update':
        await this.cacheConnectionState(body.data);
        break;
      case 'qrcode.updated':
        this.logger.log('QR code updated on Evolution API instance');
        break;
      case 'messages.upsert':
        // Inbound message — logged only, no auto-reply (one-way alert sender).
        break;
      default:
        this.logger.debug(`Unhandled event: ${body.event}`);
    }

    return { received: true };
  }

  private async cacheConnectionState(data: any) {
    const state = data?.state ?? data?.status ?? 'unknown';
    this.logger.log(`Connection status: ${state}`);
    await this.prisma.appSetting.upsert({
      where: { key: 'whatsapp.connectionState' },
      create: { key: 'whatsapp.connectionState', value: state },
      update: { value: state },
    });
  }
}
