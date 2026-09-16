import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, decodeSession } from "@/lib/auth";

const PROTECTED_PAGE_PREFIXES = [
  "/upload",
  "/templates",
  "/settings",
  "/create",
  "/ready",
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

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  const needsAuth = isProtectedPage(path) || isProtectedApi(path);
  if (!needsAuth) {
    return NextResponse.next();
  }

  if (!(await hasValidSession(request))) {
    if (isProtectedApi(path)) {
      return NextResponse.json(
        { error: "Authentication required. Please sign in first." },
        { status: 401 }
      );
    }
    const signinUrl = new URL("/auth/signin", request.url);
    signinUrl.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(signinUrl);
  }

  return NextResponse.next();
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
    "/api/upload",
    "/api/upload/:path*",
    "/api/jobs/:path*",
    "/api/email",
    "/api/email/:path*",
  ],
};
