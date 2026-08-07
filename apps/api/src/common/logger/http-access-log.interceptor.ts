import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Global HTTP access-log interceptor. Emits one structured log record per
 * request with status code and wall-clock duration. The `requestId` is attached
 * automatically by the structured logger via the correlation context.
 */
@Injectable()
export class HttpAccessLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const started = process.hrtime.bigint();
    const route = `${req.method} ${req.originalUrl}`;

    return next.handle().pipe(
      tap(() => {
        const meta = { status: res.statusCode, durationMs: this.durationMs(started) };
        if (res.statusCode >= 500) this.logger.error(route, meta);
        else if (res.statusCode >= 400) this.logger.warn(route, meta);
        else this.logger.log(route, meta);
      }),
      catchError((err) => {
        this.logger.error(
          `${route} failed`,
          err instanceof Error ? err.stack : undefined,
          { durationMs: this.durationMs(started) },
        );
        return throwError(() => err);
      }),
    );
  }

  private durationMs(started: bigint): number {
    return Number(process.hrtime.bigint() - started) / 1e6;
  }
}