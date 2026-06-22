import { Module } from '@nestjs/common';
import { RagController } from '../controllers/rag.controller';

@Module({
  controllers: [RagController],
})
export class RagModule {}
