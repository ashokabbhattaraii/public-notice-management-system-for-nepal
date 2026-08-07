import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CorrelationMiddleware } from './correlation.middleware';
import { HttpAccessLogInterceptor } from './http-access-log.interceptor';
import { StructuredLogger } from './structured-logger.service';

/**
 * Global observability module. Provides the structured JSON logger and the
 * request logging interceptor so any module can inject them without re-import.
 */
@Global()
@Module({
  providers: [
    StructuredLogger,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpAccessLogInterceptor,
    },
  ],
  exports: [StructuredLogger],
})
export class LoggerModule {}

export { CorrelationMiddleware, StructuredLogger };