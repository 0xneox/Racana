import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFromStorage, uploadToStorage } from "@/lib/storage/s3";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";
import { buildEpub } from "@/lib/epub/generator";
import { validateEpub } from "@/lib/epub/validate";
import { EBOOK_COVER_ARTIFACT } from "@/lib/cover/generator";

const EPUB_GENERATOR_VERSION = 2;
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

    // Reuse a cached EPUB only if the current generator version built it —
    // older files predate inline formatting, footnotes and packaged images.
    const s3Key = `artifacts/${params.id}/ebook-v${EPUB_GENERATOR_VERSION}.epub`;
    const epubArtifact = (job.artifacts as any[])?.find(
      (a: any) => a.artifactType === "epub" && a.s3Key === s3Key
    );

    let epubBuffer: Buffer | null = null;
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

      // Embed only the eBook front cover — never the paperback wraparound.
      let coverBuffer: Buffer | undefined;
      let coverMime: string | undefined;
      const coverArtifact = (job.artifacts as any[])?.find(
        (a: any) => a.artifactType === EBOOK_COVER_ARTIFACT
      );
      if (coverArtifact) {
        try {
          coverBuffer = await getFromStorage(coverArtifact.s3Key, coverArtifact.s3Bucket || "artifacts");
          coverMime = coverArtifact.mimeType || "image/jpeg";
        } catch {}
      }

      // Title/author the author confirmed in Cover Studio win over detection.
      let coverConfig: { title?: string; author?: string; subtitle?: string } = {};
      try {
        const cfg = await getFromStorage(`artifacts/${params.id}/cover_config.json`, "artifacts");
        coverConfig = JSON.parse(cfg.toString("utf8"));
      } catch {}

      const bookTitle = coverConfig.title?.trim() ||
        job.structureJson?.detectedTitle ||
        structure.title ||
        job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, "") ||
        "Untitled Book";
      const bookAuthor = coverConfig.author?.trim() || job.structureJson?.detectedAuthor || structure.author || "";

      const { buffer, warnings } = await buildEpub({
        title: bookTitle,
        author: bookAuthor,
        identifier: `urn:uuid:${params.id}`,
        structure: coverConfig.subtitle ? { ...structure, subtitle: coverConfig.subtitle } : structure,
        coverImageBuffer: coverBuffer,
        coverMimeType: coverMime,
      });
      if (warnings.length) console.warn(`[EPUB] ${params.id}:`, warnings.join(" | "));

      const issues = await validateEpub(buffer);
      if (issues.length) {
        logServerError("Jobs EPUB API validation", new Error(issues.map((i) => `${i.file}: ${i.message}`).join("; ")));
        return NextResponse.json(
          { error: "We couldn't produce a valid EPUB for this manuscript. Our team has been notified." },
          { status: 500 }
        );
      }
      epubBuffer = buffer;

      // Persist artifact
      try {
        await uploadToStorage(s3Key, epubBuffer, "application/epub+zip", "artifacts");
        await prisma.renderArtifact.deleteMany({ where: { jobId: params.id, artifactType: "epub" } });
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
