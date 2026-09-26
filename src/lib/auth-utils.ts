import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "./db";
import {
  createGuestToken,
  decodeGuestToken,
  GUEST_COOKIE_NAME,
  GUEST_TTL_SEC,
  SESSION_COOKIE_NAME,
  type SessionUser,
} from "./auth";
import { verifySessionToken } from "./auth/session-store";

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
  const user = await verifySessionToken(cookie.value);
  if (!user) {
    return { user: null, error: NextResponse.json(
      { error: "Session invalid or expired. Please sign in again." },
      { status: 401 }
    )};
  }
  return { user, error: null };
}

export interface Identity {
  user: SessionUser | null;
  guestId: string | null;
  /** Set when a fresh guest token was minted — caller should attach it to the response. */
  newGuestToken: string | null;
}

// Accepts a signed-in user OR an anonymous guest. When the request carries no
// identity at all a guest token is minted so the caller can attach it to the
// response — upload-first flow requires no sign-in.
export async function requireIdentity(): Promise<Identity> {
  const store = cookies();

  const sessionCookie = store.get(SESSION_COOKIE_NAME);
  if (sessionCookie?.value) {
    const user = await verifySessionToken(sessionCookie.value);
    if (user) return { user, guestId: null, newGuestToken: null };
  }

  const guestCookie = store.get(GUEST_COOKIE_NAME);
  const guestId = guestCookie?.value ? await decodeGuestToken(guestCookie.value) : null;
  if (guestId) return { user: null, guestId, newGuestToken: null };

  const newGuestId = crypto.randomUUID();
  const newGuestToken = await createGuestToken(newGuestId);
  return { user: null, guestId: newGuestId, newGuestToken };
}

// Attaches a freshly-minted guest token to a JSON response.
export function withGuestCookie<T>(response: NextResponse<T>, identity: Identity): NextResponse<T> {
  if (identity.newGuestToken) {
    response.cookies.set(GUEST_COOKIE_NAME, identity.newGuestToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_TTL_SEC,
    });
  }
  return response;
}

export async function requireJobOwner(
  jobId: string,
  identity: { userId?: string | null; guestId?: string | null }
) {
  const job = await prisma.bookJob.findUnique({
    where: { id: jobId },
    select: { id: true, userId: true, guestId: true },
  });
  if (!job) {
    return { job: null as any, error: NextResponse.json(
      { error: "Job not found." },
      { status: 404 }
    )};
  }
  const isUserOwner = !!identity.userId && job.userId === identity.userId;
  const isGuestOwner = !!identity.guestId && job.guestId === identity.guestId;
  if (!isUserOwner && !isGuestOwner) {
    return { job: null as any, error: NextResponse.json(
      { error: "You are not authorized to access this job." },
      { status: 403 }
    )};
  }
  return { job, error: null };
}
