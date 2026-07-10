import { Module } from '@nestjs/common';
import { NoticesController } from '../controllers/notices.controller';
import { NoticesService } from '../services/notices.service';

@Module({
  controllers: [NoticesController],
  providers: [NoticesService],
})
export class NoticesModule {}
