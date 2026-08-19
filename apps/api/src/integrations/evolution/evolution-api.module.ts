import { Global, Module } from '@nestjs/common';
import { EvolutionApiService } from './evolution-api.service';

/**
 * Global because the WhatsApp sender is consumed by unrelated modules
 * (alerts matching, notifications channel management, the inbound
 * webhook) — same rationale as SettingsModule.
 */
@Global()
@Module({
  providers: [EvolutionApiService],
  exports: [EvolutionApiService],
})
export class EvolutionApiModule {}
