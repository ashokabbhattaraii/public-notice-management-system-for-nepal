import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { NoticesModule } from './notices/notices.module';
import { RagModule } from './rag/rag.module';

@Module({
  imports: [AuthModule, NoticesModule, RagModule],
})
export class AppModule {}
