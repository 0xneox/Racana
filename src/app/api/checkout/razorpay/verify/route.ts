import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import {
  GENERIC_INTERNAL_ERROR,
  logServerError,
  requireIdentity,
  requireJobOwner,
} from "@/lib/auth-utils";
import { isMissingOrPlaceholder } from "@/lib/env";

// Razorpay checkout.js hands us payment_id + order_id + a signature in the
// success handler. Verifying it server-side unlocks the download immediately —
// we don't depend on the webhook being registered for the happy path.
export async function POST(request: NextRequest) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (isMissingOrPlaceholder(keySecret)) {
      return NextResponse.json({ error: "Payments not configured." }, { status: 503 });
    }

    const identity = await requireIdentity();
    const body = await request.json();
    const { jobId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {};
    if (!jobId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment details." }, { status: 400 });
    }

    const ownerRes = await requireJobOwner(jobId, {
      userId: identity.user?.id,
      guestId: identity.guestId,
    });
    if (ownerRes.error) return ownerRes.error;

    // signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
    const expected = crypto
      .createHmac("sha256", keySecret!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expected !== razorpay_signature) {
      logServerError("Razorpay Verify", new Error("Signature mismatch"));
      return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
    }

    const payment = await prisma.payment.findUnique({
      where: { razorpayOrderId: razorpay_order_id },
    });
    if (!payment) {
      return NextResponse.json({ error: "Payment not found." }, { status: 404 });
    }
    if (payment.status !== "paid") {
      await prisma.payment.update({
        where: { razorpayOrderId: razorpay_order_id },
        data: {
          status: "paid",
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    logServerError("Razorpay Verify", err);
    return NextResponse.json({ error: GENERIC_INTERNAL_ERROR }, { status: 500 });
  }
}
