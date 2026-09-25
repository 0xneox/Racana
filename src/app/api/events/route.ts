import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { decodeGuestToken, decodeSession, GUEST_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth";
import { logServerError } from "@/lib/auth-utils";

// First-party funnel events — small allowlist so the table can't be spammed
// with arbitrary rows. Umami handles pageviews; this tracks OUR funnel.
const ALLOWED_EVENTS = new Set([
  "upload_started",
  "upload_success",
  "template_chosen",
  "settings_confirmed",
  "render_started",
  "book_ready",
  "preview_downloaded",
  "checkout_started",
  "paid",
  "share_created",
  "share_x_clicked",
  "share_whatsapp_clicked",
  "share_link_copied",
  "email_book_sent",
  "signin_completed",
]);

export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    const ct = request.headers.get("content-type") || "";
    if (ct.includes("text/plain") || ct.includes("application/octet-stream")) {
      body = JSON.parse(await request.text());
    } else {
      body = await request.json();
    }

    const event = String(body?.event || "");
    if (!ALLOWED_EVENTS.has(event)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    let props = body?.props;
    if (props && typeof props === "object") {
      const json = JSON.stringify(props);
      props = json.length <= 2000 ? props : undefined;
    } else {
      props = undefined;
    }
    const jobId = typeof body?.jobId === "string" && body.jobId.length <= 64 ? body.jobId : null;

    // Identity is optional — attach when the caller has it.
    const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const user = sessionCookie ? await decodeSession(sessionCookie) : null;
    const guestCookie = request.cookies.get(GUEST_COOKIE_NAME)?.value;
    const guestId = !user && guestCookie ? await decodeGuestToken(guestCookie) : null;

    await prisma.analyticsEvent.create({
      data: {
        event,
        props: props as any,
        jobId,
        userId: user?.id || null,
        guestId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    logServerError("Events API", err);
    return NextResponse.json({ ok: true }); // analytics must never error loudly
  }
}
