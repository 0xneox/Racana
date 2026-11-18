import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import prisma from "@/lib/db";
import { getFromStorage, uploadToStorage } from "@/lib/storage/s3";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";
import {
  generateCoverSvg,
  COVER_PRESETS,
  EBOOK_COVER_ARTIFACT,
  stripCoverPlaceholders,
  type CoverDesignConfig,
  type CoverTrim,
  type CoverFormat,
} from "@/lib/cover/generator";
import { generateCoverPdf } from "@/lib/cover/pdf-fallback";
import { coverPhysicalSize } from "@/lib/cover/generator";
import { normalizeTrimSize } from "@/lib/templates/engine";
import type { BookStructureV1 } from "@/lib/manuscript/types";
import { parseFormDataWithinLimit, RequestBodyTooLargeError } from "@/lib/http/body-limit";

// ---------------------------------------------------------------------------
// Upload validation — the studio renders these files, but the server treats
// them as untrusted bytes: format, page count and physical size are all
// checked against the job's real interior before anything is stored.
// ---------------------------------------------------------------------------

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

async function isPng(blob: Blob): Promise<boolean> {
  if (blob.size > MAX_UPLOAD_BYTES) return false;
  const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  return head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
}

async function isJpeg(blob: Blob): Promise<boolean> {
  if (blob.size > MAX_UPLOAD_BYTES) return false;
  const head = new Uint8Array(await blob.slice(0, 3).arrayBuffer());
  return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}

// Returns an error message when the uploaded PDF isn't the cover this job
// needs — one page, sized to the real trim + spine of the typeset interior.
async function validateCoverPdf(bytes: Buffer, config: CoverDesignConfig): Promise<string | null> {
  if (bytes.length > MAX_UPLOAD_BYTES || bytes.subarray(0, 5).toString() !== "%PDF-") {
    return "The uploaded cover file is not a valid PDF. Re-save from the Cover Studio.";
  }
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes);
  } catch {
    return "The uploaded cover PDF could not be read. Re-save from the Cover Studio.";
  }
  if (doc.getPageCount() !== 1) {
    return "The cover PDF must be a single page (the full wrap). Re-export from the Cover Studio.";
  }
  const { width, height } = doc.getPage(0).getSize();
  const expected = coverPhysicalSize({ ...config, format: "paperback" });
  const tol = 4; // pt — allows rounding between rasterizers
  if (Math.abs(width - expected.wIn * 72) > tol || Math.abs(height - expected.hIn * 72) > tol) {
    return (
      `The cover PDF is ${(width / 72).toFixed(2)}″×${(height / 72).toFixed(2)}″ but this book needs ` +
      `${expected.wIn.toFixed(2)}″×${expected.hIn.toFixed(2)}″ (trim + spine for ${config.pageCount} pages). ` +
      "Regenerate the interior or re-export the cover so they match."
    );
  }
  return null;
}

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

    const isDevUnlock = process.env.NODE_ENV !== "production" || process.env.DEV_UNLOCK_EXPORTS === "true";
    const paid = isDevUnlock || (job.payments as any[])?.some((p: any) => p.status === "paid");

    const { searchParams } = new URL(request.url);
    const exportFormat = searchParams.get("export"); // "pdf", "png" or "svg"

    // High-resolution print exports are only available after purchase.
    // The SVG preview and studio configuration are always free so authors
    // can design and iterate before unlocking the final files.
    if ((exportFormat === "pdf" || exportFormat === "png" || exportFormat === "jpg") && !paid) {
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
      "";
    // Never invent an author — empty prints nothing on the wrap.
    const author = job.structureJson?.detectedAuthor || "";
    // The typeset interior's real page count (from print QA) sets the spine;
    // estimates are only a fallback until the interior has been rendered.
    const renderedPages = job.qaReports[0]?.pageCount;
    const pageCount =
      renderedPages ||
      job.manuscriptAsset?.pageCountEstimate ||
      structure?.estimatedPages ||
      150;
    const trimSize = normalizeTrimSize(job.settings?.trimSize || job.trimSize) as CoverTrim;

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
      saved = stripCoverPlaceholders(JSON.parse(cfgBuf.toString("utf8")) as Partial<CoverDesignConfig>);
    } catch {
      saved = null;
    }

    // Text the author hasn't written stays empty — nothing invented is ever
    // printed on their cover. Every key is sent explicitly so the studio's
    // example content can never leak through a missing field.
    const config: CoverDesignConfig = {
      title,
      subtitle: structure?.subtitle || "",
      author,
      tagline: "",
      genre: structure?.detectedBookType || "Fiction",
      spineText: title,
      backBlurb: "",
      aboutAuthor: "",
      isbn: "",
      publisher: "",
      palette: defaultPreset.palette,
      typography: defaultPreset.typography,
      ornament: defaultPreset.ornament,
      layoutStyle: defaultPreset.layoutStyle,
      format: "ebook",
      pageCount,
      paper: "cream",
      ...saved,
      // Physical facts of the interior always win over a stale saved design.
      trimSize,
      ...(renderedPages ? { pageCount: renderedPages } : {}),
    };
    if (trimSize === "8.5x11") config.paper = "white"; // KDP has no cream stock at 8.5×11

    const baseName = title.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (exportFormat === "pdf") {
      // Prefer the client-rendered artifact — it is pixel-identical to what
      // the author saw in the studio. Fall back to server-side rendering.
      const stored = await serveStoredArtifact(params.id, "cover_pdf", `${baseName}_cover.pdf`);
      if (stored) return stored;

      const pdfBytes = await generateCoverPdf({ ...config, format: "paperback" });
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

    if (exportFormat === "jpg") {
      const stored = await serveStoredArtifact(params.id, EBOOK_COVER_ARTIFACT, `${baseName}_kindle_cover.jpg`);
      if (stored) return stored;
      return NextResponse.json(
        { error: "No Kindle cover saved yet — save your design in the Cover Studio." },
        { status: 404 }
      );
    }

    if (exportFormat === "svg") {
      // The vector export stays free for design iteration but is watermarked
      // until purchase — it can be rasterized at any resolution, so giving
      // away a clean SVG would bypass the paid print exports entirely.
      const requestedFormat = (searchParams.get("format") as CoverFormat) || config.format || "ebook";
      const targetConfig = { ...config, format: requestedFormat };
      const svg = generateCoverSvg(targetConfig, { watermark: !paid });
      return new NextResponse(svg, {
        headers: {
          "Content-Type": "image/svg+xml",
        },
      });
    }

    return NextResponse.json({
      config,
      presets: COVER_PRESETS,
      paid,
      bookInfo: {
        id: job.id,
        title,
        author,
        pageCount: config.pageCount,
        pageCountFromInterior: !!renderedPages,
        trimSize,
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
      include: {
        manuscriptAsset: true,
        structureJson: true,
        settings: true,
        qaReports: { orderBy: { createdAt: "desc" }, take: 1 },
      },
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
    let ebookFile: Blob | null = null;

    if (request.headers.get("content-type")?.includes("multipart/form-data")) {
      const form = await parseFormDataWithinLimit(request, 3 * MAX_UPLOAD_BYTES + 1024 * 1024);
      const raw = form.get("config");
      config = typeof raw === "string" ? (JSON.parse(raw) as CoverDesignConfig) : null;
      const blob = (k: string) => {
        const v = form.get(k);
        return v instanceof Blob && v.size > 0 ? v : null;
      };
      pdfFile = blob("pdf");
      pngFile = blob("png");
      ebookFile = blob("ebook");
    } else {
      const body = await request.json();
      config = body.config as CoverDesignConfig;
    }

    if (!config || !config.title) {
      return NextResponse.json({ error: "Invalid cover configuration provided." }, { status: 400 });
    }
    // Client-rendered files were drawn from the config as sent; if it still
    // carries retired placeholder text, those files would print it.
    const cleaned = stripCoverPlaceholders(config);
    if (JSON.stringify(cleaned) !== JSON.stringify(config)) {
      return NextResponse.json(
        { error: "Your cover still contains sample text (ISBN, blurb or publisher). Reload the Cover Studio and save again." },
        { status: 409 }
      );
    }

    // The spine width and trim come from the typeset interior — never from
    // whatever the browser posted. Same override rule as GET above.
    const renderedPages = job.qaReports[0]?.pageCount;
    const jobTrim = normalizeTrimSize(job.settings?.trimSize || job.trimSize) as CoverTrim;
    config.trimSize = jobTrim;
    if (renderedPages) config.pageCount = renderedPages;
    if (jobTrim === "8.5x11") config.paper = "white";

    // Uploaded files are trusted only after their bytes check out: a wrong
    // trim/spine geometry here would make KDP reject the print file.
    let uploadedPdf: Buffer | null = null;
    if (pdfFile) {
      uploadedPdf = Buffer.from(await pdfFile.arrayBuffer());
      const pdfError = await validateCoverPdf(uploadedPdf, config);
      if (pdfError) {
        return NextResponse.json({ error: pdfError }, { status: 409 });
      }
    }
    if (pngFile && !(await isPng(pngFile))) {
      return NextResponse.json({ error: "The uploaded PNG is not a valid image. Re-save from the Cover Studio." }, { status: 409 });
    }
    if (ebookFile && !(await isJpeg(ebookFile))) {
      return NextResponse.json({ error: "The uploaded Kindle cover is not a valid JPEG. Re-save from the Cover Studio." }, { status: 409 });
    }

    // Persist the design so returning to the studio restores it.
    await uploadToStorage(
      `artifacts/${params.id}/cover_config.json`,
      Buffer.from(JSON.stringify(config), "utf8"),
      "application/json",
      "artifacts"
    );

    const storeArtifact = async (artifactType: string, file: string, buf: Buffer, mimeType: string, exportParam: string) => {
      const s3Key = `artifacts/${params.id}/${file}`;
      await uploadToStorage(s3Key, buf, mimeType, "artifacts");
      await prisma.renderArtifact.deleteMany({ where: { jobId: params.id, artifactType } });
      await prisma.renderArtifact.create({
        data: {
          jobId: params.id,
          artifactType,
          s3Key,
          s3Bucket: "artifacts",
          fileSizeBytes: buf.length,
          downloadUrl: `/api/jobs/${params.id}/cover?export=${exportParam}`,
          mimeType,
        },
      });
    };

    // The studio uploads every format on each save — the paperback full wrap
    // (PDF + PNG) and the Kindle front cover (JPG) — whichever tab is open.
    // Without client files, the paperback PDF is rendered server-side.
    const pdfBuffer = uploadedPdf ?? (await generateCoverPdf({ ...config, format: "paperback" }));
    await storeArtifact("cover_pdf", "cover_print_ready.pdf", pdfBuffer, "application/pdf", "pdf");
    if (pngFile) {
      await storeArtifact("cover_png", "cover_print_ready.png", Buffer.from(await pngFile.arrayBuffer()), "image/png", "png");
    }
    if (ebookFile) {
      await storeArtifact(EBOOK_COVER_ARTIFACT, "cover_kindle.jpg", Buffer.from(await ebookFile.arrayBuffer()), "image/jpeg", "jpg");
    }

    // A new cover means any cached EPUB is stale — the EPUB embeds the
    // Kindle front cover.
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
    if (err instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ error: "Cover upload exceeds the 76MB limit." }, { status: 413 });
    }
    logServerError("Jobs Cover API POST", err);
    return NextResponse.json({ error: GENERIC_INTERNAL_ERROR }, { status: 500 });
  }
}
