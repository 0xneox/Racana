import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { addJobToQueue } from "@/lib/queue/queue";
import { JobStatus } from "@prisma/client";
import { GENERIC_INTERNAL_ERROR, logServerError, requireJobOwner, requireSession } from "@/lib/auth-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await requireSession();
    if (error) return error;

    const ownerRes = await requireJobOwner(params.id, user!.id);
    if (ownerRes.error) return ownerRes.error;

    const job = await prisma.bookJob.findUnique({
      where: { id: params.id },
      include: { manuscriptAsset: true, templateChoice: true, settings: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
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
