import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RagController } from '../controllers/rag.controller';
import { RagService } from '../services/rag.service';
import { TokenRevocationModule } from '../common/token-revocation.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 60000,
    }),
    // RagController uses OptionalJwtAuthGuard.
    TokenRevocationModule,
  ],
  controllers: [RagController],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
