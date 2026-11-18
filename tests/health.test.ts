import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  checkStorageHealth: vi.fn(),
  redis: {
    status: "ready" as string,
    ping: vi.fn(),
  },
}));

vi.mock("../src/lib/db", () => ({
  default: { user: { findMany: mocks.findMany } },
}));

vi.mock("../src/lib/queue/queue", () => ({
  redisConnection: mocks.redis,
}));

vi.mock("../src/lib/storage/s3", () => ({
  checkStorageHealth: mocks.checkStorageHealth,
}));

import { GET } from "../src/app/api/health/route";

describe("health readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.redis.status = "ready";
    mocks.redis.ping.mockResolvedValue("PONG");
    mocks.checkStorageHealth.mockResolvedValue(undefined);
  });

  it("returns 503 while Redis is connecting", async () => {
    mocks.redis.status = "connecting";

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, redis: "degraded" });
  });

  it("returns 503 when Redis ping fails", async () => {
    mocks.redis.ping.mockRejectedValue(new Error("Redis unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, redis: "degraded" });
  });

  it("returns 503 when PostgreSQL does not respond", async () => {
    vi.useFakeTimers();
    try {
      mocks.findMany.mockReturnValue(new Promise<never>(() => {}));

      const responsePromise = GET();
      await vi.advanceTimersByTimeAsync(1500);
      const response = await responsePromise;

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ ok: false, postgres: "degraded" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 503 when object storage does not respond", async () => {
    vi.useFakeTimers();
    try {
      mocks.checkStorageHealth.mockReturnValue(new Promise<never>(() => {}));

      const responsePromise = GET();
      await vi.advanceTimersByTimeAsync(1500);
      const response = await responsePromise;

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ ok: false, storage: "degraded" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 503 when production object storage is unavailable", async () => {
    mocks.checkStorageHealth.mockRejectedValue(new Error("S3 unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, storage: "degraded" });
  });

  it("returns 200 only when both required dependencies are ready", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, postgres: "ok", redis: "ok" });
  });
});
