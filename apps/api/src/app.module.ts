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
import { SettingsController, PublicSettingsController } from './controllers/settings.controller';
import { MaintenanceMiddleware } from './common/maintenance.middleware';
import { LoggerModule } from './common/logger';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    LoggerModule,
    PrismaModule,
    SettingsModule,
    AuthModule,
    NoticesModule,
    DocumentsModule,
    WebhooksModule,
    RagModule,
    ScrapingModule,
  ],
  controllers: [SettingsController, PublicSettingsController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MaintenanceMiddleware).forRoutes('*');
  }
}