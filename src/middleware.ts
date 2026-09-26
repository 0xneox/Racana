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

const SUPPORTED_LOCALES = ["en", "hi", "ta", "bn"] as const;
const DEFAULT_LOCALE = "en";
// Written by the header language switcher; takes precedence over
// Accept-Language so an explicit user choice sticks across visits.
const LOCALE_COOKIE = "racana_locale";

function matchLocale(request: NextRequest): string {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (
    cookieLocale &&
    (SUPPORTED_LOCALES as readonly string[]).includes(cookieLocale)
  ) {
    return cookieLocale;
  }

  const accept = request.headers.get("accept-language");
  if (accept) {
    const requested = accept
      .split(",")
      .map((part) => {
        const [tag, q] = part.trim().split(";q=");
        return { tag: tag.trim().toLowerCase().split("-")[0], q: q ? parseFloat(q) : 1 };
      })
      .sort((a, b) => b.q - a.q)
      .map((entry) => entry.tag);

    for (const tag of requested) {
      if ((SUPPORTED_LOCALES as readonly string[]).includes(tag)) {
        return tag;
      }
    }
  }
  return DEFAULT_LOCALE;
}

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

// Continue the request while forwarding the resolved locale to server code.
// `x-next-intl-locale` must be set on the *request* headers that
// NextResponse.next({ request: { headers } }) forwards downstream —
// setting it on the response only would never reach `headers()` in
// src/i18n/request.ts.
function nextWithLocale(request: NextRequest, locale: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-next-intl-locale", locale);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const locale = matchLocale(request);

  const needsAuth = isProtectedPage(path) || isProtectedApi(path);
  if (!needsAuth) {
    return nextWithLocale(request, locale);
  }

  if (await hasValidSession(request)) {
    return nextWithLocale(request, locale);
  }

  // Guests can run the whole funnel without an account — they just need a
  // signed identity so their jobs stay theirs until they sign in.
  if (isProtectedPage(path)) {
    if (await hasValidGuest(request)) {
      return nextWithLocale(request, locale);
    }
    const response = nextWithLocale(request, locale);
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
    return nextWithLocale(request, locale);
  }
  return NextResponse.json(
    { error: "Authentication required. Please sign in first." },
    { status: 401 }
  );
}

export const config = {
  matcher: [
    // Every page (including "/", privacy, terms, the shared-book page, etc.)
    // must run through the middleware so `x-next-intl-locale` is always set.
    // _next internals and files with extensions (images, fonts, …) are
    // excluded; API routes are matched explicitly below for the auth checks.
    "/((?!api|_next|.*\\..*).*)",
    "/api/upload",
    "/api/upload/:path*",
    "/api/jobs/:path*",
    "/api/email",
    "/api/email/:path*",
  ],
};
