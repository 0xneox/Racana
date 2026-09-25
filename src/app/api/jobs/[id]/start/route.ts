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
    const limit = rateLimit(`jobstart:${identity.user?.id || identity.guestId}`, 10, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Render limit reached. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const job = await prisma.bookJob.findUnique({
      where: { id: params.id },
      include: { manuscriptAsset: true, templateChoice: true, settings: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // Idempotent: an already-rendered book doesn't re-enter the pipeline.
    if (job.status === "ready") {
      const existing = await prisma.renderArtifact.findFirst({
        where: { jobId: job.id, artifactType: "interior_pdf" },
      });
      if (existing) {
        return NextResponse.json({
          success: true,
          message: "Book already generated",
          jobId: job.id,
        });
      }
    }

    await prisma.bookJob.update({
      where: { id: params.id },
      data: {
        status: JobStatus.queued,
        progress: 5,
        currentStep: "Queueing book generation",
      },
    });

    await addJobToQueue(job.id, {
      task: "render",
      bookType: job.bookType,
      trimSize: job.trimSize,
    });

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
