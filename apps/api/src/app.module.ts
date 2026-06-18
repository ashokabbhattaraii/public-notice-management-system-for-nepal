import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { NoticesModule } from './notices/notices.module';
import { PrismaModule } from './prisma/prisma.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    NoticesModule,
    RagModule,
  ],
})
export class AppModule {}
