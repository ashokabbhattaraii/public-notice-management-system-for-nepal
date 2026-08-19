import { Module } from '@nestjs/common';
import { AlertsController } from '../controllers/alerts.controller';
import { AlertsService } from '../services/alerts.service';
import { AlertMatchingService } from '../services/alert-matching.service';
import { AlertDigestService } from '../services/alert-digest.service';
import { TokenRevocationModule } from '../common/token-revocation.module';

@Module({
  // AlertsController uses JwtAuthGuard.
  imports: [TokenRevocationModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertMatchingService, AlertDigestService],
  exports: [AlertMatchingService],
})
export class AlertsModule {}
