/**
 * Aster House Guest Assistant - Rate Limiter & Abuse Protection
 * In-memory sliding window / token bucket rate limiter with clean interface for Redis.
 */

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

export interface RateLimiter {
  check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult>;
}

export class InMemoryRateLimiter implements RateLimiter {
  private requests: Map<string, number[]> = new Map();

  async check(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const windowStart = now - windowMs;

    const timestamps = this.requests.get(key) || [];
    // Keep only timestamps within window
    const validTimestamps = timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= limit) {
      const oldest = validTimestamps[0];
      const resetSeconds = Math.ceil((oldest + windowMs - now) / 1000);
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetSeconds: Math.max(1, resetSeconds),
      };
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);

    return {
      allowed: true,
      limit,
      remaining: limit - validTimestamps.length,
      resetSeconds: windowSeconds,
    };
  }

  reset(key?: string) {
    if (key) {
      this.requests.delete(key);
    } else {
      this.requests.clear();
    }
  }
}

export const defaultRateLimiter = new InMemoryRateLimiter();
