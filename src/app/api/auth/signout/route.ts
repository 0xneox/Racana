import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { revokeSessionToken } from "@/lib/auth/session-store";
import { logServerError } from "@/lib/auth-utils";

// Dedicated sign-out endpoint. A static route shadows the /api/auth/[...nextauth]
// catch-all for this path, so both POST (fetch) and GET (link redirect) are
// handled here — the catch-all signout handlers remain as a fallback.
//
// Revocation happens server-side BEFORE the cookie is deleted, so signing out
// genuinely kills the session: a stolen cookie stops working even if the
// thief replays it after the legitimate user signs out.

export async function POST(request: NextRequest) {
  try {
    await revokeSessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  } catch (err) {
    // revokeSessionToken already swallows DB errors; belt-and-suspenders —
    // sign-out must always succeed at clearing the cookie.
    logServerError("Auth Signout", err);
  }
  const response = NextResponse.json({ success: true, message: "Signed out" });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

export async function GET(request: NextRequest) {
  await revokeSessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
