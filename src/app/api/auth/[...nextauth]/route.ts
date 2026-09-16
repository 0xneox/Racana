import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  createSessionCookieValue,
  decodeSession,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import { GENERIC_INTERNAL_ERROR, logServerError } from "@/lib/auth-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: { nextauth: string[] } }
) {
  const action = params.nextauth?.[0] || "";

  // 1. Magic link / email login stub
  if (action === "signin" || action === "callback") {
    try {
      const body = await request.json();
      const { email, name } = body;

      if (!email || !email.includes("@")) {
        return NextResponse.json(
          { error: "Valid email is required." },
          { status: 400 }
        );
      }

      // Upsert user in Postgres
      const user = await prisma.user.upsert({
        where: { email },
        create: {
          email,
          name: name || email.split("@")[0],
        },
        update: {},
      });

      const sessionData = {
        id: user.id,
        email: user.email,
        name: user.name || "Author",
      };

      const response = NextResponse.json({
        success: true,
        user: sessionData,
      });

      response.cookies.set(SESSION_COOKIE_NAME, await createSessionCookieValue(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return response;
    } catch (err) {
      logServerError("Auth Signin", err);
      return NextResponse.json(
        { error: "Authentication failed. Please try again." },
        { status: 500 }
      );
    }
  }

  // 2. Sign out
  if (action === "signout") {
    const response = NextResponse.json({ success: true, message: "Signed out" });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  // 3. Google OAuth Stub
  if (action === "google") {
    const demoGoogleUser = {
      id: "google-stub-user-01",
      email: "google.author@example.com",
      name: "Google Author",
    };

    const response = NextResponse.redirect(new URL("/upload", request.url));
    response.cookies.set(
      SESSION_COOKIE_NAME,
      await createSessionCookieValue(demoGoogleUser),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
      }
    );
    return response;
  }

  return NextResponse.json({ error: "Unsupported auth action" }, { status: 400 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { nextauth: string[] } }
) {
  const action = params.nextauth?.[0] || "";

  if (action === "session") {
    const cookie = request.cookies.get(SESSION_COOKIE_NAME);
    if (!cookie?.value) {
      return NextResponse.json({ user: null });
    }
    const user = await decodeSession(cookie.value);
    return NextResponse.json({ user });
  }

  if (action === "signout") {
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  return NextResponse.json({ status: "ok" });
}
