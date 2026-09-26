import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { logServerError } from "@/lib/auth-utils";
import { isMissingOrPlaceholder } from "@/lib/env";

// Razorpay webhook — verifies the signature and marks payments paid.
// Razorpay sends a POST with X-Razorpay-Signature header (HMAC-SHA256 of
// the raw body with the webhook secret).
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (isMissingOrPlaceholder(webhookSecret)) {
    return NextResponse.json(
      { error: "Razorpay webhooks not configured." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: {
    event: string;
    payload: {
      payment?: { entity: { id: string; order_id: string; status: string } };
      order?: { entity: { id: string } };
    };
  };

  try {
    const rawBody = await request.text();
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret!)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSignature) {
      logServerError("Razorpay Webhook", new Error("Signature mismatch"));
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }

    event = JSON.parse(rawBody);
  } catch (err) {
    logServerError("Razorpay Webhook Parse", err);
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    if (event.event === "payment.captured") {
      const payment = event.payload.payment?.entity;
      if (payment?.order_id) {
        const orderId = payment.order_id;
        const dbPayment = await prisma.payment.findUnique({
          where: { razorpayOrderId: orderId },
        });
        if (dbPayment && dbPayment.status !== "paid") {
          await prisma.payment.update({
            where: { razorpayOrderId: orderId },
            data: {
              status: "paid",
              razorpayPaymentId: payment.id,
              razorpaySignature: signature,
            },
          });
        }
      }
    }

    if (event.event === "payment.failed") {
      const payment = event.payload.payment?.entity;
      if (payment?.order_id) {
        const dbPayment = await prisma.payment.findUnique({
          where: { razorpayOrderId: payment.order_id },
        });
        if (dbPayment) {
          await prisma.payment.update({
            where: { razorpayOrderId: payment.order_id },
            data: { status: "failed" },
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    logServerError("Razorpay Webhook Handler", err);
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
