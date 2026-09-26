// Rate limiter backed by Redis (atomic INCR + PEXPIRE fixed-window counter) so
// limits persist across restarts and are shared between server instances.
// Falls back to the original in-memory sliding-window limiter when Redis is
// unreachable — availability of the endpoint beats perfect enforcement.

import { getRedisClient } from "./redis";

interface WindowEntry {
  timestamps: number[];
}

const store: Map<string, WindowEntry> =
  (globalThis as any).__rateLimitStore || new Map<string, WindowEntry>();
(globalThis as any).__rateLimitStore = store;

// Prevent unbounded growth: sweep stale entries periodically.
const SWEEP_INTERVAL_MS = 60_000;
let lastSweep = (globalThis as any).__rateLimitLastSweep || 0;
(globalThis as any).__rateLimitLastSweep = lastSweep;

function sweep(now: number, maxWindowMs: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  (globalThis as any).__rateLimitLastSweep = now;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < maxWindowMs);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

// In-memory sliding-window fallback — the original implementation, kept for
// when Redis is down (dev boxes, transient outages).
function rateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now, windowMs);

  const entry = store.get(key) || { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= limit) {
    const oldest = entry.timestamps[0];
    const retryAfterSec = Math.ceil((oldest + windowMs - now) / 1000);
    store.set(key, entry);
    return { allowed: false, remaining: 0, retryAfterSec };
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return {
    allowed: true,
    remaining: limit - entry.timestamps.length,
    retryAfterSec: 0,
  };
}

// Atomic fixed-window counter: INCR the key, set the expiry only on the first
// hit of the window, then read the TTL for Retry-After. Running it as a Lua
// script keeps INCR+PEXPIRE+PTTL atomic across concurrent instances.
const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return {current, ttl}
`;

// Don't let a degraded Redis stall requests — if the command hasn't returned
// quickly, treat Redis as unavailable and fall back to in-memory.
const REDIS_CALL_TIMEOUT_MS = 1500;

function redisCallWithTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error("redis command timed out")),
        REDIS_CALL_TIMEOUT_MS
      )
    ),
  ]);
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const redis = getRedisClient();

  // status !== "ready" means connecting/reconnecting — ioredis would buffer
  // the command, so skip straight to the fallback instead of waiting.
  if (redis && redis.status === "ready") {
    try {
      const [count, ttl] = (await redisCallWithTimeout(
        redis.eval(RATE_LIMIT_LUA, 1, `rl:${key}`, windowMs)
      )) as [number, number];

      if (count <= limit) {
        return {
          allowed: true,
          remaining: Math.max(0, limit - count),
          retryAfterSec: 0,
        };
      }

      // ttl is ms until the window resets; -1/-2 means no expiry/missing key,
      // in which case conservatively report the full window.
      const retryAfterSec =
        ttl > 0 ? Math.ceil(ttl / 1000) : Math.ceil(windowMs / 1000);
      return { allowed: false, remaining: 0, retryAfterSec };
    } catch {
      // Redis hiccup — degrade to in-memory rather than 500 the request.
    }
  }

  return rateLimitInMemory(key, limit, windowMs);
}

export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
