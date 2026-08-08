// MUST be the first import: it patches axios.create before AppModule loads,
// so every HttpService instance (created at module-load time via
// HttpModule.register) gets the correlation-id interceptor.
import './common/http/axios-correlation';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
// The compression CJS export is the middleware function itself; `import compression
// from` would desugar to `.default`, which the package doesn't provide.
import compression = require('compression');
import { AppModule } from './app.module';
import { CorrelationMiddleware, StructuredLogger } from './common/logger';

async function bootstrap() {
  // Override before the app is created so every `new Logger()` in modules uses
  // the structured JSON logger (Nest 11 supports Logger.overrideLogger).
  Logger.overrideLogger(new StructuredLogger());

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(new StructuredLogger());

  // Security hardening: sensible default headers (HSTS, X-Content-Type-Options…).
  app.use(helmet());

  // Wire each request to a correlation id, exposed via x-request-id.
  app.use(new CorrelationMiddleware().use);

  // gzip/brotli response compression — biggest single win for JSON payloads.
  app.use(compression({ threshold: 1024 }));

  // Strict CORS: only the configured web origins may call the API, with
  // credentials (cookies) and the headers the app actually uses. Origins are
  // taken from WEB_ORIGIN (comma-separated) so production can list the real
  // domain alongside localhost without a code change.
  const webOrigins = (process.env.WEB_ORIGIN ?? 'http://localhost:3535')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: webOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86400, // cache preflight for 24h so OPTIONS isn't sent per request
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Public Notice Management API')
    .setDescription('API documentation for Public Notice Management')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Graceful shutdown: close DB connections and in-flight work on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 5005;
  await app.listen(port);
  const appLogger = app.get(StructuredLogger);
  appLogger.log(`API listening on http://localhost:${port}`, 'Bootstrap', {
    env: process.env.NODE_ENV ?? 'development',
  });
}

void bootstrap();
