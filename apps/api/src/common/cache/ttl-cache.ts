/**
 * Minimal, dependency-free in-memory TTL cache with a size cap.
 *
 * Used for hot, low-churn read paths (notice category counts, source lists)
 * so repeated page loads skip the database entirely. Values are served with a
 * guard against stampedes: concurrent misses all wait on a single in-flight
 * refresh (single-flight).
 */
export class TtlCache<T> {
  private readonly store = new Map<string, { value: T; expiresAt: number }>();
  private readonly inflight = new Map<string, Promise<T>>();

  constructor(
    private readonly defaultTtlMs = 60_000,
    private readonly maxEntries = 128,
  ) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs): void {
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Return the cached value, or compute + cache it. Concurrent callers for the
   * same key share one computation (single-flight) and failures are never cached.
   */
  async remember(key: string, loader: () => Promise<T>, ttlMs = this.defaultTtlMs): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = loader()
      .then((value) => {
        this.set(key, value, ttlMs);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
