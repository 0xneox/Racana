import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFromStorage, uploadToStorage } from "@/lib/storage/s3";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";
import {
  generateCoverPdf,
  generateCoverSvg,
  COVER_PRESETS,
  type CoverDesignConfig,
} from "@/lib/cover/generator";
import type { BookStructureV1 } from "@/lib/manuscript/types";

async function serveStoredArtifact(
  jobId: string,
  artifactType: string,
  filename: string
): Promise<NextResponse | null> {
  const artifact = await prisma.renderArtifact.findFirst({
    where: { jobId, artifactType },
    orderBy: { createdAt: "desc" },
  });
  if (!artifact) return null;
  try {
    const buf = await getFromStorage(artifact.s3Key, artifact.s3Bucket);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": artifact.mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buf.length.toString(),
      },
    });
  } catch {
    return null;
  }
}

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
        settings: true,
        qaReports: { orderBy: { createdAt: "desc" }, take: 1 },
        payments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const paid = (job.payments as any[])?.some((p: any) => p.status === "paid");

    const { searchParams } = new URL(request.url);
    const exportFormat = searchParams.get("export"); // "pdf", "png" or "svg"

    // High-resolution print exports are only available after purchase.
    // The SVG preview and studio configuration are always free so authors
    // can design and iterate before unlocking the final files.
    if ((exportFormat === "pdf" || exportFormat === "png") && !paid) {
      return NextResponse.json(
        {
          error: "Print-ready cover PDF and high-res PNG are included with your purchase. Pay ₹2,450 to unlock all exports.",
          paymentRequired: true,
        },
        { status: 402 }
      );
    }

    const structure = job.structureJson?.structureData as BookStructureV1 | undefined;
    const title =
      job.structureJson?.detectedTitle ||
      job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, "") ||
      "My Book";
    const author = job.structureJson?.detectedAuthor || "Author Name";
    const pageCount =
      job.qaReports[0]?.pageCount ||
      job.manuscriptAsset?.pageCountEstimate ||
      structure?.estimatedPages ||
      150;

    // Pick recommended preset based on detected book type / script
    let defaultPreset = COVER_PRESETS[0]; // Royal Saffron
    if (structure?.detectedBookType === "philosophy" || structure?.detectedBookType === "spiritual") {
      defaultPreset = COVER_PRESETS[1]; // Peacock Indigo / Lotus
    } else if (structure?.detectedBookType === "academic") {
      defaultPreset = COVER_PRESETS[4]; // Minimalist Ivory
    } else if (structure?.detectedBookType === "memoir") {
      defaultPreset = COVER_PRESETS[2]; // Classic Obsidian
    }

    // A previously saved design wins over the auto-detected defaults, so
    // returning to the studio restores the author's work exactly. The config
    // lives in storage next to the rendered artifacts (no schema change).
    let saved: Partial<CoverDesignConfig> | null = null;
    try {
      const cfgBuf = await getFromStorage(`artifacts/${params.id}/cover_config.json`, "artifacts");
      saved = JSON.parse(cfgBuf.toString("utf8")) as Partial<CoverDesignConfig>;
    } catch {
      saved = null;
    }

    const config: CoverDesignConfig = {
      title,
      subtitle: structure?.subtitle || "",
      author,
      tagline: "First Edition",
      genre: structure?.detectedBookType || "Fiction",
      spineText: title,
      backBlurb:
        "A compelling work crafted with timeless typography, rich storytelling, and devotion to the written word. Perfect for readers and collectors alike.",
      aboutAuthor: `${author} is a dedicated storyteller with a passion for literature and cultural heritage.`,
      isbn: "978-93-000000-0-0",
      publisher: "Racana Books",
      palette: defaultPreset.palette,
      typography: defaultPreset.typography,
      ornament: defaultPreset.ornament,
      layoutStyle: defaultPreset.layoutStyle,
      format: "ebook",
      pageCount,
      ...saved,
    };

    const baseName = title.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (exportFormat === "pdf") {
      // Prefer the client-rendered artifact — it is pixel-identical to what
      // the author saw in the studio. Fall back to server-side rendering.
      const stored = await serveStoredArtifact(params.id, "cover_pdf", `${baseName}_cover.pdf`);
      if (stored) return stored;

      const pdfBytes = await generateCoverPdf(config);
      return new NextResponse(new Uint8Array(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${baseName}_cover.pdf"`,
          "Content-Length": pdfBytes.length.toString(),
        },
      });
    }

    if (exportFormat === "png") {
      const stored = await serveStoredArtifact(params.id, "cover_png", `${baseName}_cover.png`);
      if (stored) return stored;
      return NextResponse.json(
        { error: "No PNG cover saved yet — export one from the Cover Studio." },
        { status: 404 }
      );
    }

    if (exportFormat === "svg") {
      const svg = generateCoverSvg(config);
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
        },
      });
    }

    return NextResponse.json({
      config,
      presets: COVER_PRESETS,
      bookInfo: {
        id: job.id,
        title,
        author,
        pageCount,
        bookType: job.bookType,
      },
    });
  } catch (err) {
    logServerError("Jobs Cover API GET", err);
    return NextResponse.json({ error: GENERIC_INTERNAL_ERROR }, { status: 500 });
  }
}

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

    const job = await prisma.bookJob.findUnique({
      where: { id: params.id },
      include: { manuscriptAsset: true, structureJson: true },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    // The studio sends multipart/form-data: the design config plus the
    // client-rendered PDF/PNG (pixel-identical to the preview). Plain JSON
    // posts still work — we render the PDF server-side as a fallback.
    let config: CoverDesignConfig | null = null;
    let pdfFile: Blob | null = null;
    let pngFile: Blob | null = null;

    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await request.formData();
      const raw = form.get("config");
      config = typeof raw === "string" ? (JSON.parse(raw) as CoverDesignConfig) : null;
      const pdf = form.get("pdf");
      const png = form.get("png");
      pdfFile = pdf instanceof Blob ? pdf : null;
      pngFile = png instanceof Blob ? png : null;
    } else {
      const body = await request.json();
      config = body.config as CoverDesignConfig;
    }

    if (!config || !config.title) {
      return NextResponse.json({ error: "Invalid cover configuration provided." }, { status: 400 });
    }

    // Persist the design so returning to the studio restores it.
    await uploadToStorage(
      `artifacts/${params.id}/cover_config.json`,
      Buffer.from(JSON.stringify(config), "utf8"),
      "application/json",
      "artifacts"
    );

    // Store the client-rendered PDF, or fall back to server rendering.
    const pdfBuffer = pdfFile
      ? Buffer.from(await pdfFile.arrayBuffer())
      : await generateCoverPdf(config);
    const pdfKey = `artifacts/${params.id}/cover_print_ready.pdf`;
    await uploadToStorage(pdfKey, pdfBuffer, "application/pdf", "artifacts");
    await prisma.renderArtifact.deleteMany({
      where: { jobId: params.id, artifactType: "cover_pdf" },
    });
    await prisma.renderArtifact.create({
      data: {
        jobId: params.id,
        artifactType: "cover_pdf",
        s3Key: pdfKey,
        s3Bucket: "artifacts",
        fileSizeBytes: pdfBuffer.length,
        downloadUrl: `/api/jobs/${params.id}/cover?export=pdf`,
        mimeType: "application/pdf",
      },
    });

    if (pngFile) {
      const pngBuffer = Buffer.from(await pngFile.arrayBuffer());
      const pngKey = `artifacts/${params.id}/cover_print_ready.png`;
      await uploadToStorage(pngKey, pngBuffer, "image/png", "artifacts");
      await prisma.renderArtifact.deleteMany({
        where: { jobId: params.id, artifactType: "cover_png" },
      });
      await prisma.renderArtifact.create({
        data: {
          jobId: params.id,
          artifactType: "cover_png",
          s3Key: pngKey,
          s3Bucket: "artifacts",
          fileSizeBytes: pngBuffer.length,
          downloadUrl: `/api/jobs/${params.id}/cover?export=png`,
          mimeType: "image/png",
        },
      });
    }

    // A new cover means any cached EPUB is stale — the EPUB embeds cover_png.
    await prisma.renderArtifact.deleteMany({
      where: { jobId: params.id, artifactType: "epub" },
    });

    const svgStr = generateCoverSvg(config);

    return NextResponse.json({
      success: true,
      message: "Cover saved. It will restore exactly when you revisit the studio.",
      pdfDownloadUrl: `/api/jobs/${params.id}/cover?export=pdf`,
      svgPreview: svgStr,
    });
  } catch (err) {
    logServerError("Jobs Cover API POST", err);
    return NextResponse.json({ error: GENERIC_INTERNAL_ERROR }, { status: 500 });
  }
}
