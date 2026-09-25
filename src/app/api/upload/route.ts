import { NextRequest, NextResponse } from "next/server";
import { validateManuscript } from "@/lib/manuscript/validator";
import { uploadToStorage } from "@/lib/storage/s3";
import prisma from "@/lib/db";
import { BookType, JobStatus, TemplateKey, TrimSize } from "@prisma/client";
import crypto from "crypto";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, withGuestCookie } from "@/lib/auth-utils";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { addJobToQueue } from "@/lib/queue/queue";

export async function POST(request: NextRequest) {
  try {
    const identity = await requireIdentity();

    const ip = getClientIp(request);
    const limit = rateLimit(`upload:${identity.user?.id || identity.guestId}:${ip}`, 15, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Upload limit reached. Please try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const rawBookType = (formData.get("bookType") as string) || "novel";

    if (!file) {
      return NextResponse.json(
        { error: "No manuscript file was uploaded." },
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

    const bookTypeMapping: Record<string, BookType> = {
      novel: BookType.novel,
      philosophy: BookType.philosophy,
      academic: BookType.academic,
      business: BookType.business,
      memoir: BookType.memoir,
      spiritual: BookType.spiritual,
      childrens: BookType.childrens,
      other: BookType.other,
    };
    const bookType = bookTypeMapping[rawBookType.toLowerCase()] || BookType.novel;

    const sha256Checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    const job = await prisma.bookJob.create({
      data: {
        userId: identity.user?.id || null,
        guestId: identity.user ? null : identity.guestId,
        status: JobStatus.uploaded,
        progress: 0,
        currentStep: "uploaded",
        bookType,
        trimSize: TrimSize.trim_6x9,
      },
    });

    const s3Key = `uploads/${job.id}/${file.name}`;
    const storageResult = await uploadToStorage(s3Key, buffer, validation.mimeType, "manuscripts");

    await prisma.manuscriptAsset.create({
      data: {
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
    });

    await prisma.templateChoice.create({
      data: {
        jobId: job.id,
        templateKey: TemplateKey.classic,
        name: "Classic",
        personality: "Timeless Literary",
        description: "Traditional Garamond typography with elegant drop caps and classic running headers.",
      },
    });

    await prisma.bookSettings.create({
      data: {
        jobId: job.id,
        trimSize: TrimSize.trim_6x9,
      },
    });

    // Kick off structure analysis via the queue so it runs off the request
    // thread — an early response can never kill it mid-flight, and the same
    // path works on serverless where in-request work would be frozen.
    await prisma.bookJob.update({
      where: { id: job.id },
      data: { status: JobStatus.analyzing, currentStep: "Analyzing manuscript" },
    });
    const dispatch = await addJobToQueue(job.id, { task: "analyze" });
    if (!dispatch.success) {
      logServerError("Post-upload analysis dispatch", new Error("Queue dispatch failed"));
    }

    return withGuestCookie(
      NextResponse.json({
        success: true,
        jobId: job.id,
        fileName: file.name,
        pageCountEstimate: validation.pageCountEstimate,
        wordCountEstimate: validation.wordCountEstimate,
        bookType,
      }),
      identity
    );
  } catch (err) {
    logServerError("Upload API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
