import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { currentTrace } from '../logger';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  requestId: string;
}

/**
 * Backstop for everything the app doesn't explicitly catch — a raw Prisma
 * error, a thrown non-Error value, an unexpected bug. Without this, Nest's
 * default filter leaks internal messages (e.g. Prisma's full query context)
 * straight to the client and the response never carries the requestId the
 * rest of the logging stack correlates on.
 *
 * Known `HttpException`s (ValidationPipe 400s, NotFoundException, etc.) pass
 * through with their existing status/message — this only normalizes the
 * envelope and adds requestId. Anything else becomes a generic 500 with the
 * real error logged server-side but never echoed to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { requestId } = currentTrace();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const body: ErrorBody =
        typeof raw === 'string'
          ? { statusCode: status, message: raw, error: exception.name, requestId }
          : {
              statusCode: status,
              error: exception.name,
              ...(raw as Record<string, unknown>),
              requestId,
            } as ErrorBody;

      // Client errors (4xx) are expected traffic — warn, don't error, so alerting
      // stays focused on things that actually need attention.
      if (status >= 500) {
        this.logger.error(exception.message, exception.stack, requestId);
      } else {
        this.logger.warn(`${status} ${exception.message}`, requestId);
      }
      response.status(status).json(body);
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const { status, message } = mapPrismaError(exception);
      this.logger.warn(`Prisma ${exception.code}: ${exception.message}`, requestId);
      response.status(status).json({ statusCode: status, message, error: 'DatabaseError', requestId });
      return;
    }

    // Truly unexpected — log the full error server-side, never leak it to the client.
    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(err.message, err.stack, requestId);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Something went wrong on our end. Please try again.',
      error: 'InternalServerError',
      requestId,
    } satisfies ErrorBody);
  }
}

/** Maps the handful of Prisma error codes worth a distinct client-facing status. */
function mapPrismaError(exception: Prisma.PrismaClientKnownRequestError): { status: number; message: string } {
  switch (exception.code) {
    case 'P2002':
      return { status: HttpStatus.CONFLICT, message: 'A record with this value already exists.' };
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, message: 'The requested resource was not found.' };
    case 'P2003':
      return { status: HttpStatus.BAD_REQUEST, message: 'This action references a record that no longer exists.' };
    default:
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'A database error occurred.' };
  }
}
