import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  GENERIC_INTERNAL_ERROR,
  logServerError,
  requireIdentity,
  requireJobOwner,
} from "@/lib/auth-utils";
import { getAppUrl, isMissingOrPlaceholder } from "@/lib/env";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const identity = await requireIdentity();

    if (isMissingOrPlaceholder(process.env.STRIPE_SECRET_KEY)) {
      return NextResponse.json(
        { error: "Payments are not configured yet. Please check back soon." },
        { status: 503 }
      );
    }

    const ip = getClientIp(request);
    const limit = await rateLimit(`checkout:ip:${ip}`, 20, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many checkout attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const { jobId } = await request.json();
    if (!jobId || typeof jobId !== "string") {
      return NextResponse.json({ error: "jobId is required." }, { status: 400 });
    }

    const ownerRes = await requireJobOwner(jobId, {
      userId: identity.user?.id,
      guestId: identity.guestId,
    });
    if (ownerRes.error) return ownerRes.error;

    const job = await prisma.bookJob.findUnique({
      where: { id: jobId },
      include: {
        manuscriptAsset: true,
        payments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true },
        },
      },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (job.status !== "ready") {
      return NextResponse.json(
        { error: "Your book is still being typeset. Checkout unlocks when it's ready." },
        { status: 400 }
      );
    }
    if ((job.payments as any[])?.some((p) => p.status === "paid")) {
      return NextResponse.json(
        { error: "This book is already paid for.", alreadyPaid: true },
        { status: 400 }
      );
    }

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    const bookTitle =
      job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, "") || "Your Book";
    const appUrl = getAppUrl();
    const priceId = process.env.STRIPE_PRICE_ID_SINGLE_BOOK;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: identity.user?.email || undefined,
      client_reference_id: job.id,
      metadata: { jobId: job.id, userId: identity.user?.id || "" },
      line_items: [
        priceId && !isMissingOrPlaceholder(priceId)
          ? { price: priceId, quantity: 1 }
          : {
              price_data: {
                currency: "usd",
                unit_amount: 2900,
                product_data: {
                  name: `Print-Ready Interior — ${bookTitle}`.slice(0, 250),
                  description:
                    "Bookstore-grade typeset interior PDF, prepared for KDP print specifications.",
                },
              },
              quantity: 1,
            },
      ],
      success_url: `${appUrl}/ready?jobId=${job.id}&paid=1`,
      cancel_url: `${appUrl}/ready?jobId=${job.id}`,
    });

    await prisma.payment.create({
      data: {
        userId: identity.user?.id || null,
        jobId: job.id,
        stripeSessionId: session.id,
        amountCents: 2900,
        currency: "usd",
        status: "pending",
        provider: "stripe",
      },
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (err) {
    logServerError("Checkout API", err);
    return NextResponse.json({ error: GENERIC_INTERNAL_ERROR }, { status: 500 });
  }
}
