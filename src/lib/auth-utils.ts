import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import prisma from "./db";
import { decodeSession, SESSION_COOKIE_NAME } from "./auth";

export const GENERIC_INTERNAL_ERROR = "Internal server error. Please try again later.";

export function logServerError(prefix: string, err: unknown) {
  const ts = new Date().toISOString();
  const msg = err instanceof Error ? err.stack || err.message : String(err);
  console.error(`[${ts}] ${prefix} :: ${msg}`);
}

export async function requireSession() {
  const cookie = cookies().get(SESSION_COOKIE_NAME);
  if (!cookie?.value) {
    return { user: null, error: NextResponse.json(
      { error: "Authentication required." },
      { status: 401 }
    )};
  }
  const user = await decodeSession(cookie.value);
  if (!user) {
    return { user: null, error: NextResponse.json(
      { error: "Session invalid or expired. Please sign in again." },
      { status: 401 }
    )};
  }
  return { user, error: null };
}

export async function requireJobOwner(
  jobId: string,
  userId: string
) {
  const job = await prisma.bookJob.findUnique({
    where: { id: jobId },
    select: { id: true, userId: true },
  });
  if (!job) {
    return { job: null as any, error: NextResponse.json(
      { error: "Job not found." },
      { status: 404 }
    )};
  }
  if (!job.userId || job.userId !== userId) {
    return { job: null as any, error: NextResponse.json(
      { error: "You are not authorized to access this job." },
      { status: 403 }
    )};
  }
  return { job, error: null };
}
