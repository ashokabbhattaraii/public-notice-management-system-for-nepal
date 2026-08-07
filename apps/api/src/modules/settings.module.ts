import { Module, Global } from '@nestjs/common';
import { SettingsService } from '../services/settings.service';

/**
 * Settings is consumed by many modules (scheduler, notices, auth, webhooks,
 * maintenance middleware), so it is exported globally rather than re-imported
 * by each consumer.
 */
@Global()
@Module({
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}