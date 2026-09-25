import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  createGuestToken,
  decodeGuestToken,
  decodeSession,
  GUEST_COOKIE_NAME,
  GUEST_TTL_SEC,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";

const PROTECTED_PAGE_PREFIXES = [
  "/upload",
  "/templates",
  "/settings",
  "/create",
  "/ready",
  "/books",
];

const PROTECTED_API_PREFIXES = [
  "/api/upload",
  "/api/jobs",
  "/api/email",
];

function isProtectedPage(path: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

function isProtectedApi(path: string): boolean {
  return PROTECTED_API_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(SESSION_COOKIE_NAME);
  if (!cookie?.value) return false;
  const user = await decodeSession(cookie.value);
  return !!user;
}

async function hasValidGuest(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(GUEST_COOKIE_NAME);
  if (!cookie?.value) return false;
  const guestId = await decodeGuestToken(cookie.value);
  return !!guestId;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const needsAuth = isProtectedPage(path) || isProtectedApi(path);
  if (!needsAuth) {
    return NextResponse.next();
  }

  if (await hasValidSession(request)) {
    return NextResponse.next();
  }

  // Guests can run the whole funnel without an account — they just need a
  // signed identity so their jobs stay theirs until they sign in.
  if (isProtectedPage(path)) {
    if (await hasValidGuest(request)) {
      return NextResponse.next();
    }
    const response = NextResponse.next();
    const token = await createGuestToken(crypto.randomUUID());
    response.cookies.set(GUEST_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_TTL_SEC,
    });
    return response;
  }

  // API routes: session or guest token must already exist (a page visit mints
  // it); the upload route additionally mints one itself for API-first calls.
  if (await hasValidGuest(request)) {
    return NextResponse.next();
  }
  return NextResponse.json(
    { error: "Authentication required. Please sign in first." },
    { status: 401 }
  );
}

export const config = {
  matcher: [
    "/upload",
    "/upload/:path*",
    "/templates",
    "/templates/:path*",
    "/settings",
    "/settings/:path*",
    "/create",
    "/create/:path*",
    "/ready",
    "/ready/:path*",
    "/books",
    "/books/:path*",
    "/api/upload",
    "/api/upload/:path*",
    "/api/jobs/:path*",
    "/api/email",
    "/api/email/:path*",
  ],
};
