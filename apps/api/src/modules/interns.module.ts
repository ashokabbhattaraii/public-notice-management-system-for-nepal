import { Module } from '@nestjs/common';
import { InternsController } from '../controllers/interns.controller';
import { InternsService } from '../services/interns.service';

@Module({
  controllers: [InternsController],
  providers: [InternsService],
  exports: [InternsService],
})
export class InternsModule {}
