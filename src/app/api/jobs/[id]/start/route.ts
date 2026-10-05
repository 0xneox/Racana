import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { addJobToQueue } from "@/lib/queue/queue";
import { JobStatus } from "@prisma/client";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireIdentity();

    const ownerRes = await requireJobOwner(params.id, {
      userId: identity.user?.id,
      guestId: identity.guestId,
    });
    if (ownerRes.error) return ownerRes.error;

    const ip = getClientIp(request);
    const limit = await rateLimit(`jobstart:${identity.user?.id || identity.guestId}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Render limit reached. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const job = await prisma.bookJob.findUnique({
      where: { id: params.id },
      include: {
        manuscriptAsset: true,
        templateChoice: true,
        settings: true,
        payments: {
          orderBy: { createdAt: "desc" },
          select: { status: true, createdAt: true, updatedAt: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // Idempotent: an already-rendered book doesn't re-enter the pipeline —
    // unless the caller explicitly asks for a re-render ({regenerate: true}),
    // which paid books get free for 30 days after payment.
    if (job.status === "ready") {
      const existing = await prisma.renderArtifact.findFirst({
        where: { jobId: job.id, artifactType: "interior_pdf" },
      });
      if (existing) {
        const body = await request.json().catch(() => ({}));
        if (body?.regenerate !== true) {
          return NextResponse.json({
            success: true,
            message: "Book already generated",
            jobId: job.id,
          });
        }
        const paidPayment = (job.payments as any[])?.find((p: any) => p.status === "paid");
        if (!paidPayment) {
          return NextResponse.json(
            { error: "Re-generation is included with purchase.", paymentRequired: true },
            { status: 402 }
          );
        }
        const paidAt = new Date(paidPayment.updatedAt || paidPayment.createdAt).getTime();
        if (Date.now() - paidAt > 30 * 24 * 60 * 60 * 1000) {
          return NextResponse.json(
            { error: "The 30-day free re-generation window for this book has expired." },
            { status: 403 }
          );
        }
        // Fresh artifacts — the worker recreates them all. Stale rows are
        // removed so downloads never serve the previous render.
        await prisma.renderArtifact.deleteMany({ where: { jobId: job.id } });
        await prisma.qAReport.deleteMany({ where: { jobId: job.id } });
      }
    }

    // Double-enqueue guard: reject if the job is already in a non-terminal
    // processing state.  Without this, two rapid POST /start calls run
    // processBookJob concurrently for the same jobId, creating duplicate
    // artifacts and interleaving status writes.
    const processingStates: JobStatus[] = [
      JobStatus.queued,
      JobStatus.typesetting,
      JobStatus.qa,
      JobStatus.fixing,
      JobStatus.analyzing,
    ];
    if (processingStates.includes(job.status)) {
      return NextResponse.json(
        { error: "This book is already being processed. Please wait for it to finish." },
        { status: 409 }
      );
    }

    await prisma.bookJob.update({
      where: { id: params.id },
      data: {
        status: JobStatus.queued,
        progress: 5,
        currentStep: "Queueing book generation",
      },
    });

    const dispatch = await addJobToQueue(job.id, {
      task: "render",
      bookType: job.bookType,
      trimSize: job.trimSize,
    });
    if (!dispatch.success) {
      logServerError("Job Start API", new Error("Queue dispatch failed for job " + job.id));
      return NextResponse.json(
        { error: "Could not start processing. Please try again." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Job processing started",
      jobId: job.id,
    });
  } catch (err) {
    logServerError("Job Start API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
