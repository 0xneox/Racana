// Lightweight sliding-window rate limiter. In-memory per process — appropriate
// for a single-instance soft launch. Swap for Redis-backed limits when scaling
// beyond one instance.

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

export function rateLimit(
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

export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
