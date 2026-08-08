import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScrapingController } from '../controllers/scraping.controller';
import { ScrapingService } from '../services/scraping.service';
import { ScrapingSchedulerService } from '../services/scraping-scheduler.service';
import { SettingsModule } from './settings.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 300000,
    }),
    SettingsModule,
  ],
  controllers: [ScrapingController],
  providers: [ScrapingService, ScrapingSchedulerService],
  exports: [ScrapingService, ScrapingSchedulerService],
})
export class ScrapingModule {}
