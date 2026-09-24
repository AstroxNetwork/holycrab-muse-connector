/**
 * In-process token buckets. The connector is stateless and runs on a few
 * instances, so this is a per-instance ceiling, not an accounting system:
 * enough to stop one token or one IP from turning a leaked credential or a
 * scripted client into thousands of upstream calls a minute.
 *
 * NOTE: this is a *courtesy* limit. The real spend control for a metered
 * provider (see budget.ts) must be authoritative and shared across
 * instances once you have more than one.
 *
 * Ported from 1Claw AI's muse-connector (Apache-2.0). See NOTICE.
 */
export interface RateLimiter {
  /** True when the caller may proceed; false when over the limit. */
  take(key: string, now?: number): boolean;
}

export function createRateLimiter(perMinute: number, maxKeys = 10_000): RateLimiter {
  const buckets = new Map<string, { tokens: number; updated: number }>();
  const refillPerMs = perMinute / 60_000;
  return {
    take(key, now = Date.now()) {
      let b = buckets.get(key);
      if (!b) {
        if (buckets.size >= maxKeys) {
          // Evict the stalest entry rather than growing without bound.
          let oldestKey: string | undefined;
          let oldest = Infinity;
          for (const [k, v] of buckets) {
            if (v.updated < oldest) {
              oldest = v.updated;
              oldestKey = k;
            }
          }
          if (oldestKey !== undefined) buckets.delete(oldestKey);
        }
        b = { tokens: perMinute, updated: now };
        buckets.set(key, b);
      }
      const elapsed = Math.max(0, now - b.updated);
      b.tokens = Math.min(perMinute, b.tokens + elapsed * refillPerMs);
      b.updated = now;
      if (b.tokens < 1) return false;
      b.tokens -= 1;
      return true;
    },
  };
}
