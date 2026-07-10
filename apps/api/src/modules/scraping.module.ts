import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ScrapingController } from '../controllers/scraping.controller';
import { ScrapingService } from '../services/scraping.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 300000,
    }),
  ],
  controllers: [ScrapingController],
  providers: [ScrapingService],
})
export class ScrapingModule {}
