import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { withTrace, TraceContext } from './trace-context';

/**
 * Assigns each inbound request a unique `requestId`, persists it in
 * AsyncLocalStorage, and echoes it back to the caller in the `x-request-id`
 * response header so failures can be correlated client-side.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const supplied = req.headers['x-request-id'];
    const requestId =
      (Array.isArray(supplied) ? supplied[0] : supplied)?.slice(0, 64) || randomUUID();

    res.setHeader('x-request-id', requestId);

    const trace: TraceContext = {
      requestId,
      method: req.method,
      path: req.originalUrl || req.url,
      ip: req.ip ?? req.socket?.remoteAddress,
      userAgent: req.headers['user-agent']?.slice(0, 256),
    };

    withTrace(trace, next);
  }
}