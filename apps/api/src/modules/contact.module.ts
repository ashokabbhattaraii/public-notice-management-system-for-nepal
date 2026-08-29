import { Module } from '@nestjs/common';
import { NotificationsModule } from './notifications.module';
import { ContactService } from '../services/contact.service';
import { ContactController, AdminContactController } from '../controllers/contact.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [ContactController, AdminContactController],
  providers: [ContactService],
  exports: [ContactService],
})
export class ContactModule {}
