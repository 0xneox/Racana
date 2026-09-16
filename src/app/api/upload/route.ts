import { NextRequest, NextResponse } from "next/server";
import { validateManuscript } from "@/lib/manuscript/validator";
import { uploadToStorage } from "@/lib/storage/s3";
import prisma from "@/lib/db";
import { BookType, JobStatus, TemplateKey, TrimSize } from "@prisma/client";
import crypto from "crypto";
import { GENERIC_INTERNAL_ERROR, logServerError, requireSession } from "@/lib/auth-utils";

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireSession();
    if (error) return error;

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
        userId: user!.id,
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

    return NextResponse.json({
      success: true,
      jobId: job.id,
      fileName: file.name,
      pageCountEstimate: validation.pageCountEstimate,
      wordCountEstimate: validation.wordCountEstimate,
      bookType,
    });
  } catch (err) {
    logServerError("Upload API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
