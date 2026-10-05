import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { validateManuscript } from "@/lib/manuscript/validator";
import { uploadToStorage } from "@/lib/storage/s3";
import { JobStatus } from "@prisma/client";
import crypto from "crypto";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { addJobToQueue } from "@/lib/queue/queue";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

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
    const limit = await rateLimit(`replace:${identity.user?.id || identity.guestId}:${ip}`, 15, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many revision uploads. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const job = await prisma.bookJob.findUnique({
      where: { id: params.id },
      include: {
        payments: {
          orderBy: { createdAt: "desc" },
        },
        manuscriptAsset: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // A job mid-pipeline must not have its manuscript swapped out — that
    // races the renderer and corrupts the run.
    if (["analyzing", "queued", "typesetting", "qa", "fixing"].includes(job.status)) {
      return NextResponse.json(
        { error: "This book is still being generated — try again once it finishes." },
        { status: 409 }
      );
    }

    // Check 30-day revision grace period if book is paid
    const paidPayment = job.payments.find((p: any) => p.status === "paid");
    if (paidPayment) {
      const paidDate = new Date(paidPayment.updatedAt || paidPayment.createdAt).getTime();
      const elapsed = Date.now() - paidDate;
      if (elapsed > THIRTY_DAYS_MS) {
        return NextResponse.json(
          { error: "The 30-day free revision grace period for this book has expired." },
          { status: 403 }
        );
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No revised manuscript file was provided." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const validation = validateManuscript(buffer, file.name, file.type);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 422 }
      );
    }

    const sha256Checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    const safeFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 100) || "revised_manuscript";

    const s3Key = `uploads/${job.id}/${Date.now()}_${safeFileName}`;
    const storageResult = await uploadToStorage(s3Key, buffer, validation.mimeType, "manuscripts");

    // Atomically update asset, clean old artifacts/reports/structure, reset job
    await prisma.$transaction([
      prisma.manuscriptAsset.upsert({
        where: { jobId: job.id },
        create: {
          jobId: job.id,
          fileName: file.name,
          fileSizeBytes: buffer.length,
          mimeType: validation.mimeType,
          s3Key,
          s3Bucket: storageResult.bucket,
          pageCountEstimate: validation.pageCountEstimate,
          wordCountEstimate: validation.wordCountEstimate,
          sha256Checksum,
        },
        update: {
          fileName: file.name,
          fileSizeBytes: buffer.length,
          mimeType: validation.mimeType,
          s3Key,
          s3Bucket: storageResult.bucket,
          pageCountEstimate: validation.pageCountEstimate,
          wordCountEstimate: validation.wordCountEstimate,
          sha256Checksum,
        },
      }),
      prisma.bookStructureJSON.deleteMany({ where: { jobId: job.id } }),
      prisma.renderArtifact.deleteMany({ where: { jobId: job.id } }),
      prisma.qAReport.deleteMany({ where: { jobId: job.id } }),
      prisma.bookJob.update({
        where: { id: job.id },
        data: {
          status: JobStatus.queued,
          progress: 5,
          currentStep: "Queueing revised book generation",
          errorMessage: null,
        },
      }),
    ]);

    // Dispatch render task to worker queue
    const dispatch = await addJobToQueue(job.id, {
      task: "render",
      bookType: job.bookType,
      trimSize: job.trimSize,
    });

    if (!dispatch.success) {
      logServerError("Replace Manuscript Queue Dispatch", new Error("Queue dispatch failed for job " + job.id));
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      fileName: file.name,
      pageCountEstimate: validation.pageCountEstimate,
      wordCountEstimate: validation.wordCountEstimate,
      message: "Revised manuscript uploaded. Re-generating your book interior...",
    });
  } catch (err) {
    logServerError("Replace Manuscript API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
