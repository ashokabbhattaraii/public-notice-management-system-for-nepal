import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request correlation context. Populated by the correlation middleware and
 * read by the structured logger so every log record emitted while handling a
 * request carries the same `requestId`, making distributed tracing trivial.
 */
export interface TraceContext {
  requestId: string;
  method: string;
  path: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
}

export const traceStorage = new AsyncLocalStorage<TraceContext>();

/** Best-effort snapshot of the current correlation context (empty when outside a request). */
export function currentTrace(): TraceContext {
  return traceStorage.getStore() ?? {
    requestId: '-',
    method: '-',
    path: '-',
  };
}

/** Run a function inside the given correlation context. */
export function withTrace<T>(context: TraceContext, fn: () => T): T {
  return traceStorage.run(context, fn);
}

/**
 * Run an async function inside the current correlation context. Required for
 * fire-and-forget work (e.g. background PDF extraction) that outlives the
 * request handler — otherwise its logs would lose the requestId.
 */
export function withTraceAsync<T>(fn: () => Promise<T>): Promise<T> {
  const parent = traceStorage.getStore();
  return parent ? traceStorage.run(parent, fn) : fn();
}