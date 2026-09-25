import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";
import { sendEmail } from "@/lib/email/resend";
import { getAppUrl } from "@/lib/env";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const identity = await requireIdentity();

    const ip = getClientIp(request);
    const limit = rateLimit(`email:ip:${ip}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many emails requested. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const { jobId, email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    if (!jobId) {
      return NextResponse.json(
        { error: "A valid jobId is required." },
        { status: 400 }
      );
    }

    const ownerRes = await requireJobOwner(jobId, {
      userId: identity.user?.id,
      guestId: identity.guestId,
    });
    if (ownerRes.error) return ownerRes.error;

    const job = await prisma.bookJob.findUnique({
      where: { id: jobId },
      include: { manuscriptAsset: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // Capture the guest's email on the job — if they later sign in with it,
    // their books merge into the account automatically.
    if (!identity.user && identity.guestId) {
      await prisma.bookJob
        .update({ where: { id: jobId }, data: { contactEmail: email.toLowerCase().trim() } })
        .catch(() => {});
    }

    const bookTitle = job.manuscriptAsset?.fileName.replace(/\.[^/.]+$/, "") || "Your Manuscript";
    const downloadLink = `${getAppUrl()}/ready?jobId=${jobId}`;
    const subject = `Your print-ready book interior: ${bookTitle}`;
    const text = `Hello!\n\nYour manuscript "${bookTitle}" has been rendered into a print-ready PDF. Download it here: ${downloadLink}\n\nThanks for using Racana!`;
    const html = `
      <div style="font-family: Georgia, serif; padding: 24px; color: #222;">
        <h2 style="color: #4a3f35;">Your Book Interior Is Ready</h2>
        <p>Hello,</p>
        <p>Your manuscript <strong>${bookTitle}</strong> has been successfully rendered into a print-ready PDF.</p>
        <p><a href="${downloadLink}" style="color:#A34825;">Download your finished book</a></p>
        <p style="margin-top: 32px; color: #888; font-size: 12px;">Racana &middot; racana.studio &middot; Your manuscript in. Your finished book out.</p>
      </div>
    `;

    const result = await sendEmail({ to: email, subject, html, text });

    const emailLog = await prisma.emailLog.create({
      data: {
        jobId,
        recipientEmail: email,
        subject,
        status: result.status,
        resendMessageId: result.messageId,
      },
    });

    if (!result.delivered) {
      logServerError("Email API", new Error(result.error || "Delivery unavailable (RESEND_API_KEY not configured)"));
      return NextResponse.json(
        { error: "Email delivery isn't available right now — please use the download button instead." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Print-ready book link sent to ${email}!`,
      logId: emailLog.id,
    });
  } catch (err) {
    logServerError("Email API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
