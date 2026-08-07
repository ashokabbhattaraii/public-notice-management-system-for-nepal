/**
 * Single-flight executor with failure backoff.
 *
 * Concurrent callers for the same key share ONE in-flight task instead of each
 * firing their own upstream call (the "10 users open the same notice → 10
 * duplicate AI summaries" stampede). After a task fails, the key enters a
 * cooldown window so a flaky/failing upstream isn't hammered by every viewer
 * retrying at once.
 */
export class SingleFlightCooldownError extends Error {
  constructor(readonly key: string) {
    super(`task '${key}' in failure cooldown`);
    this.name = 'SingleFlightCooldownError';
  }
}

export class SingleFlight {
  private readonly inflight = new Map<string, Promise<unknown>>();
  private readonly retryAt = new Map<string, number>();

  constructor(private readonly retryAfterMs = 60_000) {}

  /**
   * Run `task` for `key`, sharing any in-flight execution. Rejects with
   * `SingleFlightCooldownError` (without running `task`) while the key is in
   * failure cooldown — callers can distinguish "skipped, try later" from a
   * real upstream failure.
   */
  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const pending = this.inflight.get(key);
    if (pending) return pending as Promise<T>;

    const cooldownUntil = this.retryAt.get(key);
    if (cooldownUntil !== undefined && Date.now() < cooldownUntil) {
      return Promise.reject(new SingleFlightCooldownError(key));
    }

    const promise = task()
      .finally(() => {
        this.inflight.delete(key);
      })
      .catch((err) => {
        // Backoff for failed runs so a flaky upstream isn't pounded; a
        // completed-but-empty result is the caller's business (they often
        // stamp a DB sentinel).
        this.retryAt.set(key, Date.now() + this.retryAfterMs);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /** Drop all in-flight state and cooldowns (tests, admin "reset" actions). */
  clear(): void {
    this.inflight.clear();
    this.retryAt.clear();
  }
}
