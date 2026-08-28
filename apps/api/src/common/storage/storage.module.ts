import { Global, Module } from '@nestjs/common';
import { S3StorageService } from './s3-storage.service';

// Global so any feature module can inject S3StorageService without
// re-importing it, matching PrismaModule's pattern.
@Global()
@Module({
  providers: [S3StorageService],
  exports: [S3StorageService],
})
export class StorageModule {}
