import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NoticesController } from '../controllers/notices.controller';
import { NoticesService } from '../services/notices.service';

@Module({
  imports: [HttpModule.register({ timeout: 30000 })],
  controllers: [NoticesController],
  providers: [NoticesService],
})
export class NoticesModule {}
