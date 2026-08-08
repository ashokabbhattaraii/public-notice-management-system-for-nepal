import {Controller, Post,Logger, Body,Headers} from '@nestjs/common'
import {WhatsappService} from './whatsapp-webhook.service'

@Controller('webhooks')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(private readonly whatsappService: WhatsappService) {}

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

    // Handle different event types
    switch (body.event) {
      case 'messages.upsert':
        await this.handleIncomingMessage(body.data);
        break;
      case 'connection.update':
        this.logger.log(`Connection status: ${JSON.stringify(body.data)}`);
        break;
      case 'messages.update':
        this.logger.log(`Message updated: ${JSON.stringify(body.data)}`);
        break;
      default:
        this.logger.debug(`Unhandled event: ${body.event}`);
    }

    return { received: true };
  }

  private async handleIncomingMessage(data: any) {
    // Skip messages sent by us
    if (data.key?.fromMe) return;

    const sender = data.key?.remoteJid?.replace('@s.whatsapp.net', '');
    const messageText =
      data.message?.conversation ||
      data.message?.extendedTextMessage?.text ||
      '';

    if (!sender || !messageText) return;

    this.logger.log(`Message from ${sender}: ${messageText}`);

    // Example: Auto-reply (customize your logic here)
    await this.whatsappService.sendMessage(
      sender,
      `✅ Received your message: "${messageText}"\n\nWe'll get back to you soon!`,
    );
  }
}