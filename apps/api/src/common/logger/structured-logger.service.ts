import { Injectable, LoggerService } from '@nestjs/common';
import { currentTrace } from './trace-context';

/**
 * Redacted on output — any object key (case-insensitive, suffix-tolerant) that
 * matches one of these patterns has its value replaced with "[REDACTED]".
 * Covers credentials, tokens, cookies and PII no matter how they are nested.
 */
const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api_key',
  'apikey',
  'credential',
  'id_token',
  'client_secret',
  'private_key',
  'card_number',
  'cvv',
  'email',
  'phone',
];

const MAX_LOG_LENGTH = 8_192;

export type LoggerOutputMode = 'json' | 'pretty';

// Nest's LogLevel is: log | warn | error | verbose | debug | fatal. "info" is
// accepted as an alias in LOG_LEVEL env but normalizes to "log" (Nest's name).
type Level = 'verbose' | 'debug' | 'log' | 'warn' | 'error' | 'fatal';

function resolveLevel(): Level {
  const configured = (process.env.LOG_LEVEL ?? 'log').toLowerCase();
  const raw = configured === 'info' ? 'log' : configured;
  const levels: Level[] = ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'];
  return (levels as string[]).includes(raw) ? (raw as Level) : 'log';
}

/** Cut values longer than MAX_LOG_LENGTH so a runaway field can never flood the log sink. */
function truncate(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[depth-limited]';
  if (typeof value === 'string') {
    return value.length > MAX_LOG_LENGTH ? `${value.slice(0, MAX_LOG_LENGTH)}…[truncated]` : value;
  }
  if (Array.isArray(value)) return value.map((v) => truncate(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = truncate(val, depth + 1);
    }
    return out;
  }
  return value;
}

function isSensitiveKey(key: string): boolean {
  const k = key.toLowerCase();
  return SENSITIVE_KEYS.some((pattern) => k === pattern || k.includes(pattern));
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[depth-limited]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? '[REDACTED]' : redact(val, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Structured JSON logger used as the NestJS LoggerService override.
 *
 * This class is deliberately tolerant of Nest's calling conventions: the same
 * codebase emits logs via Nest's reusable `Logger` class in many shapes
 * (`log(msg)`, `log(msg, ctx)`, `error(msg, stack, ctx)`, `warn(msg, meta)`).
 * Every record is emitted as a single JSON line (or a colored, readable line in
 * pretty mode) with the per-request `requestId` injected from AsyncLocalStorage
 * so logs remain attributable end-to-end.
 */
@Injectable()
export class StructuredLogger implements LoggerService {
  private readonly levelIndex: Record<Level, number> = {
    verbose: 0,
    debug: 1,
    log: 2,
    warn: 3,
    error: 4,
    fatal: 5,
  };

  private readonly minLevel: Level;
  private readonly mode: LoggerOutputMode;

  constructor() {
    this.minLevel = resolveLevel();
    this.mode = (process.env.LOG_FORMAT ?? '').toLowerCase() === 'pretty' ? 'pretty' : 'json';
  }

  setLogLevels(_levels: string[]): void {
    // Runtime level adjustment hook — reserved for future dynamic control.
  }

  log(message: unknown, ...optional: unknown[]) {
    this.write('log', message, undefined, ...optional);
  }
  error(message: unknown, ...optional: unknown[]) {
    this.write('error', message, undefined, ...optional);
  }
  warn(message: unknown, ...optional: unknown[]) {
    this.write('warn', message, undefined, ...optional);
  }
  debug(message: unknown, ...optional: unknown[]) {
    this.write('debug', message, undefined, ...optional);
  }
  verbose(message: unknown, ...optional: unknown[]) {
    this.write('verbose', message, undefined, ...optional);
  }
  fatal(message: unknown, ...optional: unknown[]) {
    this.write('fatal', message, undefined, ...optional);
  }
  info(message: unknown, ...optional: unknown[]) {
    this.write('log', message, undefined, ...optional);
  }

  private write(
    level: Level,
    message: unknown,
    context: string | undefined,
    ...optional: unknown[]
  ) {
    if (this.levelIndex[level] < this.levelIndex[this.minLevel]) return;

    // Tolerate multiple calling conventions for the trailing params:
    //   - a stack string (multi-line) becomes err.stack
    //   - a short string becomes the context
    //   - an object becomes structured metadata (merged)
    let stack: string | undefined;
    let meta: Record<string, unknown> = {};
    for (const param of optional) {
      if (param == null) continue;
      if (typeof param === 'string') {
        if (param.includes('\n')) stack = param;
        else if (!context || param !== context) context = param;
      } else if (typeof param === 'object') {
        meta = { ...meta, ...(param as Record<string, unknown>) };
      }
    }

    const trace = currentTrace();
    const record: Record<string, unknown> = {
      ts: new Date().toISOString(),
      level,
      msg: this.toMessage(message),
      context: context ?? 'Application',
      req: {
        requestId: trace.requestId,
        method: trace.method,
        path: trace.path,
        ...(trace.ip ? { ip: trace.ip } : {}),
        ...(trace.userAgent ? { userAgent: trace.userAgent } : {}),
        ...(trace.userId ? { userId: trace.userId } : {}),
      },
    };

    if (message instanceof Error) {
      const err = message as Error & { cause?: unknown };
      record.err = {
        name: err.name,
        message: err.message,
        ...(err.stack ? { stack: err.stack } : {}),
        ...(err.cause
          ? { cause: err.cause instanceof Error ? err.cause.message : err.cause }
          : {}),
      };
    } else if (stack) {
      record.err = { stack };
    }

    const metaKeys = Object.keys(meta);
    if (metaKeys.length > 0) {
      record.meta = truncate(redact(meta));
    }

    const line = this.mode === 'pretty' ? this.pretty(record, level) : JSON.stringify(record);
    if (level === 'error' || level === 'fatal') {
      process.stderr.write(`${line}\n`);
    } else {
      process.stdout.write(`${line}\n`);
    }
  }

  private toMessage(message: unknown): string {
    if (message instanceof Error) return message.message;
    if (typeof message === 'string') return message;
    if (message && typeof message === 'object') {
      return JSON.stringify(redact(message));
    }
    return String(message);
  }

  private pretty(record: Record<string, unknown>, level: Level): string {
    const colors: Record<string, string> = {
      verbose: '\x1b[90m',
      debug: '\x1b[36m',
      log: '\x1b[32m',
      warn: '\x1b[33m',
      error: '\x1b[31m',
      fatal: '\x1b[35m',
    };
    const reset = '\x1b[0m';
    const req = record.req as Record<string, unknown>;
    const scope = `${req?.method ?? ''} ${req?.path ?? ''}`.trim();
    const meta =
      record.meta && Object.keys(record.meta as object).length
        ? ` ${JSON.stringify(record.meta)}`
        : '';
    return [
      `\x1b[90m${String(record.ts)}\x1b[0m`,
      `${colors[level]}${level.toUpperCase().padEnd(5)}${reset}`,
      `\x1b[36m${String(record.context)}\x1b[0m`,
      `${String(record.msg)}${meta}`,
      scope ? `\x1b[90m(${scope})\x1b[0m` : '',
    ].join(' ');
  }
}