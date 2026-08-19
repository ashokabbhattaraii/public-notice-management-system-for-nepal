import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth.module';
import { NoticesModule } from './modules/notices.module';
import { DocumentsModule } from './modules/documents.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PrismaModule } from './prisma/prisma.module';
import { RagModule } from './modules/rag.module';
import { ScrapingModule } from './modules/scraping.module';
import { SettingsModule } from './modules/settings.module';
import { BillingModule } from './modules/billing.module';
import { EvolutionApiModule } from './integrations/evolution/evolution-api.module';
import { AlertsModule } from './modules/alerts.module';
import { NotificationsModule } from './modules/notifications.module';
import { SettingsController, PublicSettingsController } from './controllers/settings.controller';
import { HealthController } from './controllers/health.controller';
import { MaintenanceMiddleware } from './common/maintenance.middleware';
import { LoggerModule } from './common/logger';
import { TokenRevocationModule } from './common/token-revocation.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    LoggerModule,
    // SettingsController is registered here and is guarded by JwtAuthGuard.
    TokenRevocationModule,
    PrismaModule,
    SettingsModule,
    EvolutionApiModule,
    AuthModule,
    NoticesModule,
    DocumentsModule,
    WebhooksModule,
    RagModule,
    ScrapingModule,
    AlertsModule,
    NotificationsModule,
    BillingModule,
  ],
  controllers: [HealthController, SettingsController, PublicSettingsController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MaintenanceMiddleware).forRoutes('*');
  }
}