import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFromStorage, uploadToStorage } from "@/lib/storage/s3";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";
import { generateEpub } from "@/lib/epub/generator";
import type { BookStructureV1 } from "@/lib/manuscript/types";

export async function GET(
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

    const job = await prisma.bookJob.findUnique({
      where: { id: params.id },
      include: {
        artifacts: true,
        manuscriptAsset: true,
        structureJson: true,
        payments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, amountCents: true, currency: true, createdAt: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const paid = (job.payments as any[])?.some((p: any) => p.status === "paid");
    if (!paid) {
      return NextResponse.json(
        {
          error: "The EPUB edition is included with your print-ready purchase. Pay ₹2,450 to unlock the clean PDF, the EPUB, and all exports.",
          paymentRequired: true,
        },
        { status: 402 }
      );
    }

    // Check if an EPUB artifact already exists
    const epubArtifact = (job.artifacts as any[])?.find(
      (a: any) => a.artifactType === "epub"
    );

    let epubBuffer: Buffer | null = null;
    const s3Key = epubArtifact?.s3Key || `artifacts/${params.id}/ebook.epub`;
    const s3Bucket = epubArtifact?.s3Bucket || "artifacts";

    if (epubArtifact) {
      try {
        epubBuffer = await getFromStorage(s3Key, s3Bucket);
      } catch {
        // regenerate on fallback
        epubBuffer = null;
      }
    }

    if (!epubBuffer) {
      const structure = job.structureJson?.structureData as BookStructureV1 | undefined;
      if (!structure) {
        return NextResponse.json(
          { error: "Manuscript structure not available for EPUB conversion." },
          { status: 400 }
        );
      }

      // Check if a cover image artifact exists to embed
      let coverBuffer: Buffer | undefined;
      let coverMime: string | undefined;
      const coverArtifact = (job.artifacts as any[])?.find(
        (a: any) => a.artifactType === "cover_png" || a.artifactType === "cover_jpg"
      );
      if (coverArtifact) {
        try {
          coverBuffer = await getFromStorage(coverArtifact.s3Key, coverArtifact.s3Bucket || "artifacts");
          coverMime = coverArtifact.mimeType || "image/png";
        } catch {}
      }

      const bookTitle = job.structureJson?.detectedTitle ||
        job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, "") ||
        "Untitled Book";
      const bookAuthor = job.structureJson?.detectedAuthor || "Author";

      epubBuffer = await generateEpub({
        title: bookTitle,
        author: bookAuthor,
        structure,
        coverImageBuffer: coverBuffer,
        coverMimeType: coverMime,
      });

      // Persist artifact
      try {
        await uploadToStorage(s3Key, epubBuffer, "application/epub+zip", "artifacts");
        await prisma.renderArtifact.create({
          data: {
            jobId: params.id,
            artifactType: "epub",
            s3Key,
            s3Bucket: "artifacts",
            fileSizeBytes: epubBuffer.length,
            downloadUrl: `/api/jobs/${params.id}/epub`,
            mimeType: "application/epub+zip",
          },
        });
      } catch (saveErr) {
        console.warn("[EPUB] Artifact caching deferred:", (saveErr as Error).message);
      }
    }

    const baseName = (job.manuscriptAsset?.fileName || "book")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${baseName}_ebook.epub`;

    return new NextResponse(new Uint8Array(epubBuffer), {
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": epubBuffer.length.toString(),
      },
    });
  } catch (err) {
    logServerError("Jobs EPUB API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
