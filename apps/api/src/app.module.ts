import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth.module';
import { NoticesModule } from './modules/notices.module';
import { DocumentsModule } from './modules/documents.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { PrismaModule } from './prisma/prisma.module';
import { RagModule } from './modules/rag.module';
import { InternsModule } from './modules/interns.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    NoticesModule,
    DocumentsModule,
    WebhooksModule,
    RagModule,
    InternsModule,
  ],
})
export class AppModule {}
