import { Module } from '@nestjs/common';
import { NotificationsController } from '../controllers/notifications.controller';
import { AdminWhatsappController } from '../controllers/admin-whatsapp.controller';
import { NotificationsService } from '../services/notifications.service';
import { TokenRevocationModule } from '../common/token-revocation.module';

@Module({
  // NotificationsController/AdminWhatsappController use JwtAuthGuard (+ RolesGuard for admin).
  imports: [TokenRevocationModule],
  controllers: [NotificationsController, AdminWhatsappController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
