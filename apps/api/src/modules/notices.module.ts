import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NoticesController } from '../controllers/notices.controller';
import { NoticesService } from '../services/notices.service';

@Module({
  imports: [HttpModule.register({ timeout: 30000 })],
  controllers: [NoticesController],
  providers: [NoticesService],
  // ScrapingController reuses the extraction pipeline for its admin
  // "re-extract" actions.
  exports: [NoticesService],
})
export class NoticesModule {}
