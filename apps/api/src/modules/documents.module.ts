import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DocumentsController } from '../controllers/documents.controller';
import { DocumentsService } from '../services/documents.service';
import { SystemDocumentsService } from '../services/system-documents.service';
import { TokenRevocationModule } from '../common/token-revocation.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 120000,
    }),
    // DocumentsController uses JwtAuthGuard/OptionalJwtAuthGuard.
    TokenRevocationModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, SystemDocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
