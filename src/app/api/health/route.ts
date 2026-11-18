import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { redisConnection } from "@/lib/queue/queue";
import { checkStorageHealth } from "@/lib/storage/s3";

export const dynamic = "force-dynamic";

const startedAt = Date.now();
const HEALTH_CHECK_TIMEOUT_MS = 1500;

async function withHealthTimeout<T>(
  check: () => Promise<T>,
  dependency: string
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<T>((_, reject) => {
      timeout = setTimeout(
        () => reject(new Error(`${dependency} health check timed out`)),
        HEALTH_CHECK_TIMEOUT_MS
      );
    });
    return await Promise.race([
      Promise.resolve().then(check),
      timedOut,
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function dependencyStatus(
  check: () => Promise<unknown>,
  dependency: string
): Promise<"ok" | "degraded"> {
  try {
    await withHealthTimeout(check, dependency);
    return "ok";
  } catch {
    return "degraded";
  }
}

export async function GET() {
  const [postgres, redis, storage] = await Promise.all([
    dependencyStatus(
      () => prisma.user.findMany({ take: 1, select: { id: true } }),
      "Postgres"
    ),
    dependencyStatus(async () => {
      const connection = redisConnection;
      if (!connection || connection.status !== "ready") {
        throw new Error("Redis is not ready");
      }
      await connection.ping();
    }, "Redis"),
    dependencyStatus(() => checkStorageHealth(), "Object storage"),
  ]);

  const ok = postgres === "ok" && redis === "ok" && storage === "ok";
  return NextResponse.json({
    ok,
    uptime: Math.round((Date.now() - startedAt) / 1000),
    racana: "v1.0",
    postgres,
    redis,
    storage,
  }, { status: ok ? 200 : 503 });
}
