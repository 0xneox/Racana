import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { redisConnection } from "@/lib/queue/queue";

export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  let postgres = "ok";
  try {
    await prisma.user.findMany({ take: 1 } as any);
  } catch {
    postgres = "degraded";
  }

  let redis = "ok";
  try {
    if (!redisConnection || redisConnection.status === "end") {
      redis = "degraded";
    }
  } catch {
    redis = "degraded";
  }

  return NextResponse.json({
    ok: postgres === "ok",
    uptime: Math.round((Date.now() - startedAt) / 1000),
    racana: "v1.0",
    postgres,
    redis,
  });
}
