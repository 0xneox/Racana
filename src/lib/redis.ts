import Redis from "ioredis";

// Shared non-BullMQ Redis client for general-purpose use (rate limiting,
// caching, etc.). BullMQ keeps its own dedicated connection in
// lib/queue/queue.ts — its required `maxRetriesPerRequest: null` setting is
// wrong for ad-hoc commands, which should fail fast so callers can degrade.

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

let client: Redis | null = (globalThis as any).__racanaRedis || null;
let initFailed = (globalThis as any).__racanaRedisInitFailed || false;

export function getRedisClient(): Redis | null {
  if (client) return client;
  if (initFailed) return null;

  try {
    client = new Redis(redisUrl, {
      // Fail commands quickly instead of queueing them — a rate-limit check
      // that hangs is worse than one that falls back to in-memory.
      maxRetriesPerRequest: 1,
      retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying in offline/test runs
        return Math.min(times * 100, 1000);
      },
    });

    client.on("error", () => {
      // Swallowed on purpose: callers check status/handle command failures
      // and fall back gracefully. An unhandled 'error' event would crash.
    });

    // Under vitest an open socket keeps the process alive — unref so the
    // runner can exit cleanly (mirrors the queue.ts workaround).
    if (process.env.VITEST === "true") {
      const rc = client as any;
      rc.unref?.();
      (rc.stream || rc.connector?.stream)?.unref?.();
    }

    (globalThis as any).__racanaRedis = client;
  } catch {
    initFailed = true;
    (globalThis as any).__racanaRedisInitFailed = true;
    client = null;
  }

  return client;
}
