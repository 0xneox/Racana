import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { logServerError } from "@/lib/auth-utils";
import { isMissingOrPlaceholder } from "@/lib/env";

export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (isMissingOrPlaceholder(secretKey) || isMissingOrPlaceholder(webhookSecret)) {
    return NextResponse.json(
      { error: "Stripe webhooks not configured." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  let event: import("stripe").Stripe.Event;
  try {
    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(secretKey!);
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret!);
  } catch (err) {
    logServerError("Stripe Webhook Signature", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as import("stripe").Stripe.Checkout.Session;
      const sessionId = session.id;

      const payment = await prisma.payment.findUnique({
        where: { stripeSessionId: sessionId },
      });
      if (payment && payment.status !== "paid") {
        await prisma.payment.update({
          where: { stripeSessionId: sessionId },
          data: {
            status: "paid",
            stripePaymentIntentId:
              typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id || null,
          },
        });
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object as import("stripe").Stripe.Charge;
      const pi =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (pi) {
        // Mark the related payment refunded so downloads re-lock.
        const payment = await prisma.payment.findUnique({
          where: { stripePaymentIntentId: pi },
        }).catch(() => null);
        if (payment) {
          await prisma.payment.update({
            where: { stripePaymentIntentId: pi },
            data: { status: "refunded" },
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    logServerError("Stripe Webhook Handler", err);
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
