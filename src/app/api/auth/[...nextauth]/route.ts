import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import {
  decodeGuestToken,
  GUEST_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from "@/lib/auth";
import {
  createServerSession,
  revokeSessionToken,
  verifySessionToken,
} from "@/lib/auth/session-store";
import {
  consumeMagicLinkToken,
  createMagicLink,
  sanitizeCallbackUrl,
} from "@/lib/auth/magic-link";
import { GENERIC_INTERNAL_ERROR, logServerError } from "@/lib/auth-utils";
import { sendEmail } from "@/lib/email/resend";
import { getAppUrl, isMissingOrPlaceholder } from "@/lib/env";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const GOOGLE_STATE_COOKIE = "g_oauth_state";

// Claim anonymous guest jobs for the newly signed-in user — both jobs owned by
// this browser's guest token and jobs where the guest typed this email.
async function mergeGuestJobs(request: NextRequest, userId: string, email: string) {
  try {
    const guestCookie = request.cookies.get(GUEST_COOKIE_NAME)?.value;
    const guestId = guestCookie ? await decodeGuestToken(guestCookie) : null;
    await prisma.bookJob.updateMany({
      where: {
        userId: null,
        OR: [
          { guestId: guestId || "__none__" },
          { contactEmail: email.toLowerCase() },
        ],
      },
      data: { userId },
    });
  } catch (err) {
    logServerError("Auth MergeGuestJobs", err);
  }
}

function setSessionCookie(
  response: NextResponse,
  cookieValue: string
): NextResponse {
  response.cookies.set(SESSION_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

function googleConfigured(): boolean {
  return (
    !isMissingOrPlaceholder(process.env.GOOGLE_CLIENT_ID) &&
    !isMissingOrPlaceholder(process.env.GOOGLE_CLIENT_SECRET)
  );
}

function magicLinkEmail(to: string, url: string) {
  const subject = "Your Racana sign-in link";
  const text = `Hello,\n\nClick this link to sign in to Racana (valid for 15 minutes):\n${url}\n\nIf you didn't request this, you can ignore this email.`;
  const html = `
    <div style="font-family: Georgia, serif; padding: 24px; color: #222;">
      <h2 style="color: #4a3f35;">Sign in to Racana</h2>
      <p>Click the button below to sign in. This link is valid for 15 minutes and can only be used once.</p>
      <p><a href="${url}" style="display:inline-block;background:#1C1917;color:#F8F5EE;padding:12px 24px;border-radius:8px;text-decoration:none;">Sign In</a></p>
      <p style="margin-top:24px;color:#888;font-size:12px;">Or paste this link into your browser:<br/>${url}</p>
      <p style="margin-top:32px;color:#888;font-size:12px;">If you didn't request this link, you can safely ignore this email.<br/>Racana &middot; racana.studio</p>
    </div>`;
  return { subject, text, html };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { nextauth: string[] } }
) {
  const action = params.nextauth?.[0] || "";

  // Request a magic sign-in link. NEVER logs anyone in directly — the session
  // is only issued after the emailed one-time token is consumed (GET verify).
  if (action === "signin" || action === "callback") {
    try {
      const ip = getClientIp(request);
      const ipLimit = await rateLimit(`signin:ip:${ip}`, 20, 15 * 60 * 1000);
      if (!ipLimit.allowed) {
        return NextResponse.json(
          { error: "Too many sign-in attempts. Please try again later." },
          { status: 429, headers: { "Retry-After": String(ipLimit.retryAfterSec) } }
        );
      }

      const body = await request.json();
      const email = (body.email || "").trim().toLowerCase();
      const name = typeof body.name === "string" ? body.name.slice(0, 120) : "";
      const callbackUrl = sanitizeCallbackUrl(body.callbackUrl);

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json(
          { error: "Valid email is required." },
          { status: 400 }
        );
      }

      const emailLimit = await rateLimit(`signin:email:${email}`, 5, 15 * 60 * 1000);
      if (!emailLimit.allowed) {
        return NextResponse.json(
          { error: "Too many sign-in links requested. Please check your inbox or try again later." },
          { status: 429, headers: { "Retry-After": String(emailLimit.retryAfterSec) } }
        );
      }

      const { url } = await createMagicLink(email, name, callbackUrl);
      const { subject, text, html } = magicLinkEmail(email, url);
      const result = await sendEmail({ to: email, subject, html, text });

      const allowDevLink =
        process.env.NODE_ENV !== "production" ||
        process.env.ALLOW_DEV_MAGIC_LINK === "true";

      if (!result.delivered) {
        if (!allowDevLink) {
          logServerError("Auth MagicLink", new Error(result.error || "Email not configured"));
          return NextResponse.json(
            { error: "Email sign-in is temporarily unavailable. Please try again later." },
            { status: 503 }
          );
        }
        // Local dev convenience: no Resend key → hand the link back so the
        // developer can click it directly. Never exposed in production.
        console.warn(`[Auth] DEV magic link for ${email}: ${url}`);
        return NextResponse.json({
          success: true,
          message: "Dev mode: email delivery not configured.",
          devLink: url,
        });
      }

      return NextResponse.json({
        success: true,
        message: "Check your inbox for a sign-in link.",
      });
    } catch (err) {
      logServerError("Auth Signin", err);
      return NextResponse.json({ error: GENERIC_INTERNAL_ERROR }, { status: 500 });
    }
  }

  if (action === "signout") {
    // Revoke the server-side session BEFORE clearing the cookie — without a
    // valid cookie we can no longer identify which session to kill.
    await revokeSessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    const response = NextResponse.json({ success: true, message: "Signed out" });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  return NextResponse.json({ error: "Unsupported auth action" }, { status: 400 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { nextauth: string[] } }
) {
  const action = params.nextauth?.[0] || "";
  const sub = params.nextauth?.[1] || "";

  // Which providers are configured — lets the UI hide dead buttons.
  if (action === "providers") {
    return NextResponse.json({ google: googleConfigured() });
  }

  // Consume a magic-link token → real session.
  if (action === "verify") {
    const token = request.nextUrl.searchParams.get("token") || "";
    try {
      const verified = await consumeMagicLinkToken(token);
      if (!verified) {
        return NextResponse.redirect(
          new URL("/auth/signin?error=invalid_link", request.url)
        );
      }

      const user = await prisma.user.upsert({
        where: { email: verified.email },
        create: {
          email: verified.email,
          name: verified.name || verified.email.split("@")[0],
        },
        update: verified.name ? { name: verified.name } : {},
      });

      await mergeGuestJobs(request, user.id, user.email);

      const target = sanitizeCallbackUrl(verified.callbackUrl);
      const response = NextResponse.redirect(new URL(target, request.url));
      return setSessionCookie(
        response,
        await createServerSession({
          id: user.id,
          email: user.email,
          name: user.name || "Author",
        })
      );
    } catch (err) {
      logServerError("Auth Verify", err);
      return NextResponse.redirect(
        new URL("/auth/signin?error=verify_failed", request.url)
      );
    }
  }

  // Real Google OAuth — only active when GOOGLE_CLIENT_ID/SECRET are set.
  if (action === "google" && !sub) {
    if (!googleConfigured()) {
      return NextResponse.json(
        { error: "Google sign-in is not configured." },
        { status: 400 }
      );
    }
    const callbackUrl = sanitizeCallbackUrl(
      request.nextUrl.searchParams.get("callbackUrl")
    );
    const state = crypto.randomBytes(16).toString("hex");
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
    authUrl.searchParams.set(
      "redirect_uri",
      `${getAppUrl()}/api/auth/google/callback`
    );
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", `${state}.${callbackUrl}`);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set(GOOGLE_STATE_COOKIE, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  }

  if (action === "google" && sub === "callback") {
    if (!googleConfigured()) {
      return NextResponse.redirect(new URL("/auth/signin", request.url));
    }
    try {
      const code = request.nextUrl.searchParams.get("code");
      const stateParam = request.nextUrl.searchParams.get("state") || "";
      const [state, rawCallback] = stateParam.split(".");
      const callbackUrl = sanitizeCallbackUrl(rawCallback);

      const cookieState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;
      if (!code || !state || state !== cookieState) {
        return NextResponse.redirect(
          new URL("/auth/signin?error=oauth_state", request.url)
        );
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${getAppUrl()}/api/auth/google/callback`,
          grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) throw new Error("Google token exchange failed");
      const tokens = (await tokenRes.json()) as { access_token?: string };
      if (!tokens.access_token) throw new Error("No access token from Google");

      const profileRes = await fetch(
        "https://openidconnect.googleapis.com/v1/userinfo",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );
      if (!profileRes.ok) throw new Error("Google userinfo failed");
      const profile = (await profileRes.json()) as {
        email?: string;
        name?: string;
      };
      if (!profile.email) throw new Error("Google account has no email");

      const email = profile.email.toLowerCase();
      const user = await prisma.user.upsert({
        where: { email },
        create: { email, name: profile.name || email.split("@")[0] },
        update: {},
      });

      await mergeGuestJobs(request, user.id, user.email);

      const response = NextResponse.redirect(new URL(callbackUrl, request.url));
      response.cookies.delete(GOOGLE_STATE_COOKIE);
      return setSessionCookie(
        response,
        await createServerSession({
          id: user.id,
          email: user.email,
          name: user.name || "Author",
        })
      );
    } catch (err) {
      logServerError("Auth GoogleCallback", err);
      return NextResponse.redirect(
        new URL("/auth/signin?error=oauth_failed", request.url)
      );
    }
  }

  if (action === "session") {
    const cookie = request.cookies.get(SESSION_COOKIE_NAME);
    if (!cookie?.value) {
      return NextResponse.json({ user: null });
    }
    const user = await verifySessionToken(cookie.value);
    return NextResponse.json({ user });
  }

  if (action === "signout") {
    await revokeSessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    const response = NextResponse.redirect(new URL("/", request.url));
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  return NextResponse.json({ status: "ok" });
}
