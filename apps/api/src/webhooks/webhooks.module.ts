import { Module } from '@nestjs/common';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappService } from './whatsapp-webhook.service';

@Module({
  controllers: [WhatsappWebhookController],
  providers: [WhatsappService],
})
export class WebhooksModule {}