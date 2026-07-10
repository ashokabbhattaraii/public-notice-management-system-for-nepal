import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DocumentsController } from '../controllers/documents.controller';
import { DocumentsService } from '../services/documents.service';
import { SystemDocumentsService } from '../services/system-documents.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 120000,
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, SystemDocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
