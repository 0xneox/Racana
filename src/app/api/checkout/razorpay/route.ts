import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import {
  GENERIC_INTERNAL_ERROR,
  logServerError,
  requireIdentity,
  requireJobOwner,
} from '@/lib/auth-utils';
import { getAppUrl, isMissingOrPlaceholder } from '@/lib/env';
import { getClientIp, rateLimit } from '@/lib/rate-limit';
import Razorpay from 'razorpay';

/**
 * Razorpay checkout endpoint for Indian users.
 * Creates a Razorpay order and records a pending payment in the database.
 */
export async function POST(request: NextRequest) {
  try {
    const identity = await requireIdentity();

    if (isMissingOrPlaceholder(process.env.RAZORPAY_KEY_ID) || isMissingOrPlaceholder(process.env.RAZORPAY_KEY_SECRET)) {
      return NextResponse.json(
        { error: 'Payments are not configured yet. Please check back soon.' },
        { status: 503 }
      );
    }

    const ip = getClientIp(request);
    const limit = await rateLimit(`razorpay:ip:${ip}`, 20, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many checkout attempts. Please try again later.' },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const { jobId } = await request.json();
    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json({ error: 'jobId is required.' }, { status: 400 });
    }

    const ownerRes = await requireJobOwner(jobId, {
      userId: identity.user?.id,
      guestId: identity.guestId,
    });
    if (ownerRes.error) return ownerRes.error;

    const job = await prisma.bookJob.findUnique({
      where: { id: jobId },
      include: { manuscriptAsset: true, payments: { orderBy: { createdAt: 'desc' }, select: { id: true, status: true } } },
    });
    if (!job) {
      return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
    }
    if (job.status !== 'ready') {
      return NextResponse.json(
        { error: "Your book is still being typeset. Checkout unlocks when it's ready." },
        { status: 400 }
      );
    }
    if ((job.payments as any[])?.some(p => p.status === 'paid')) {
      return NextResponse.json({ error: 'This book is already paid for.', alreadyPaid: true }, { status: 400 });
    }

    const appUrl = getAppUrl();
    const bookTitle = job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, '') || 'Your Book';

    // ₹2,450 in paise
    const amountPaise = 2450 * 100;
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `job_${job.id}`,
      notes: { jobId: job.id, userId: identity.user?.id || '' },
    });

    // Record the pending payment.
    await prisma.payment.create({
      data: {
        userId: identity.user?.id || null,
        jobId: job.id,
        razorpayOrderId: order.id,
        amountCents: amountPaise / 100,
        currency: 'inr',
        status: 'pending',
        provider: 'razorpay',
      },
    });

    // Return order details for the frontend to open Razorpay checkout.
    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      name: bookTitle,
      description: `Print-Ready Interior — ${bookTitle}`,
      // URLs for post‑payment redirects.
      successUrl: `${appUrl}/ready?jobId=${job.id}&paid=1`,
      cancelUrl: `${appUrl}/ready?jobId=${job.id}`,
    });
  } catch (err) {
    logServerError('Razorpay Checkout API', err);
    return NextResponse.json({ error: GENERIC_INTERNAL_ERROR }, { status: 500 });
  }
}
