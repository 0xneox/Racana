import { Worker, Job } from "bullmq";
import path from "path";
import { redisConnection } from "./queue";
import prisma from "../db";
import { JobStatus, BookType } from "@prisma/client";
import { getFromStorage, uploadToStorage } from "../storage/s3";
import { startRetentionSweepTimer } from "../retention";
import { analyzeManuscript } from "../ai/analyzer";
import { resolveAppRoot } from "../app-root";
import type { BookStructureV1, Block } from "../manuscript/types";

// Structured JSON logging for worker events.  Parseable by log aggregators
// (Datadog, CloudWatch, etc.) and greppable in production.
function logEvent(event: string, data: Record<string, unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level: "info",
    source: "worker",
    event,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

function logError(event: string, jobId: string, err: Error, data: Record<string, unknown> = {}) {
  const entry = {
    ts: new Date().toISOString(),
    level: "error",
    source: "worker",
    event,
    jobId,
    error: err.message,
    stack: err.stack?.split("\n").slice(0, 3).join("\n"),
    ...data,
  };
  console.error(JSON.stringify(entry));
}

// Each step maps to real work done at that checkpoint — no placeholder stages.
// The /create checklist UI mirrors these labels and progress values.
export const CHECKLIST_STEPS = [
  { step: "Manuscript analyzed", status: JobStatus.analyzing, progress: 12 },
  { step: "Chapters detected", status: JobStatus.structure_ready, progress: 25 },
  { step: "Typography applied", status: JobStatus.typesetting, progress: 40 },
  { step: "Layout generated", status: JobStatus.typesetting, progress: 60 },
  { step: "Images checked", status: JobStatus.qa, progress: 72 },
  { step: "Trim & print checks", status: JobStatus.qa, progress: 85 },
  { step: "Final PDF generated", status: JobStatus.fixing, progress: 95 },
  { step: "Book ready", status: JobStatus.ready, progress: 100 },
];

// Maximum time for a full render pipeline.  The Typst compile itself has a
// 120s timeout in compiler.ts; this wraps the entire process (analysis +
// generation + compile + QA + upload) so a stuck job can never hang the
// worker indefinitely.
const JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// Runs manuscript analysis for a job and persists the detected structure.
export async function runAnalysisForJob(jobId: string): Promise<boolean> {
  const job = await prisma.bookJob.findUnique({
    where: { id: jobId },
    include: { manuscriptAsset: true },
  });
  if (!job) return false;

  const asset = job.manuscriptAsset;
  if (!asset || !asset.s3Key || !asset.s3Bucket) {
    throw new Error("No manuscript asset for analyzer");
  }
  const msBuffer = await getFromStorage(asset.s3Key, asset.s3Bucket);
  if (!msBuffer || msBuffer.length < 100) {
    throw new Error("Manuscript bytes missing or empty in storage");
  }

  const structure = await analyzeManuscript(
    msBuffer,
    asset.mimeType || "application/octet-stream",
    asset.fileName || "manuscript"
  );

  const bookTypeEnum =
    structure.detectedBookType &&
    Object.values(BookType).includes(structure.detectedBookType as BookType)
      ? (structure.detectedBookType as BookType)
      : undefined;

  await prisma.bookStructureJSON.upsert({
    where: { jobId },
    create: {
      jobId,
      detectedTitle: structure.title,
      detectedAuthor: structure.author,
      chapterCount: structure.chapterCount,
      detectedBookType: bookTypeEnum,
      structureData: structure as any,
    },
    update: {
      detectedTitle: structure.title,
      detectedAuthor: structure.author,
      chapterCount: structure.chapterCount,
      detectedBookType: bookTypeEnum,
      structureData: structure as any,
    },
  });

  // The analyzer's book type is the single source of truth — sync it back
  // onto the job so anything reading job.bookType (cover presets, queue
  // payloads) reflects the manuscript, not a stale default.
  if (bookTypeEnum) {
    await prisma.bookJob
      .update({ where: { id: jobId }, data: { bookType: bookTypeEnum } })
      .catch(() => {});
  }

  return true;
}

// Queue task: analyze an uploaded manuscript and flip the job to
// structure_ready (or failed). Runs off the request thread so an upload
// response returning early can never kill the analysis mid-flight.
export async function runAnalysisTask(jobId: string): Promise<void> {
  await prisma.bookJob
    .update({
      where: { id: jobId },
      data: { status: JobStatus.analyzing, currentStep: "Analyzing manuscript" },
    })
    .catch(() => {});
  try {
    await runAnalysisForJob(jobId);
    await prisma.bookJob.update({
      where: { id: jobId },
      data: { status: JobStatus.structure_ready, currentStep: "Structure detected" },
    });
  } catch (err) {
    logError("analysis_failed", jobId, err as Error);
    await prisma.bookJob
      .update({
        where: { id: jobId },
        data: {
          status: JobStatus.failed,
          currentStep: "Manuscript analysis failed",
          errorMessage:
            "We couldn't read the structure of this file. Try re-exporting your manuscript as .docx and uploading again.",
        },
      })
      .catch(() => {});
    // Rethrow so BullMQ sees the failure and can apply its retry policy.
    // Without this, the error is swallowed and BullMQ thinks the job
    // succeeded — `attempts: 2` never triggers.
    throw err;
  }
}

function blockTextLength(b: Block): number {
  let n = (b.text || "").trim().length;
  if (b.items) n += b.items.join("").length;
  if (b.rows) n += b.rows.reduce((s, r) => s + r.cells.reduce((m, c) => m + c.text.length, 0), 0);
  return n;
}

// A job is renderable when chapters carry real words, or front/back matter
// holds enough text to typeset (e.g. a dedication-only booklet is refused).
// First ~3 pages of the real typeset interior for the /ready gallery:
// front matter (max 2 entries) + the opening of chapter one.
function truncateStructureForPreview(data: BookStructureV1): BookStructureV1 {
  const clone: BookStructureV1 = JSON.parse(JSON.stringify(data));
  clone.frontMatter = (clone.frontMatter || []).slice(0, 2);
  clone.backMatter = [];
  const first = (clone.chapters || [])[0];
  if (first) {
    let budget = 14;
    first.sections = (first.sections || []).map((s) => {
      const blocks = (s.blocks || []).slice(0, Math.max(0, budget));
      budget -= blocks.length;
      return { ...s, blocks };
    }).filter((s) => s.blocks.length > 0 || s.title);
    clone.chapters = [first];
  }
  return clone;
}

function hasRenderableContent(data: BookStructureV1): boolean {
  const chapterWords = (data.chapters || []).reduce((n, c) => n + (c.wordCount || 0), 0);
  if (chapterWords >= 50) return true;

  let chars = 0;
  const scan = (blocks?: Block[]) => blocks?.forEach((b) => (chars += blockTextLength(b)));
  data.frontMatter?.forEach((f) => scan(f.blocks));
  data.chapters?.forEach((c) => c.sections?.forEach((s) => scan(s.blocks)));
  data.backMatter?.forEach((b) => scan(b.blocks));
  return chars >= 200;
}

export async function processBookJob(jobId: string, pacingMs = 0) {
  logEvent("job_started", { jobId });

  // Wrap the entire pipeline in a timeout so a stuck job can never hang
  // the worker indefinitely.  The Typst compile itself has a 120s timeout
  // in compiler.ts; this catches hangs in analysis, QA, or storage upload.
  return Promise.race([
    processBookJobInner(jobId, pacingMs),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Job timed out after 15 minutes.")),
        JOB_TIMEOUT_MS
      )
    ),
  ]).catch((err) => {
    // The inner function already calls fail() and rethrows.  If we get here
    // it's either the timeout or a rethrown error — both have already been
    // recorded in the DB.  Rethrow so BullMQ can apply its retry policy.
    throw err;
  });
}

async function processBookJobInner(jobId: string, pacingMs = 0) {

  const job = await prisma.bookJob.findUnique({
    where: { id: jobId },
    include: {
      manuscriptAsset: true,
      templateChoice: true,
      settings: true,
    },
  });

  if (!job) {
    console.error(`[Worker] Job ${jobId} not found in database.`);
    return;
  }

  const pace = () =>
    pacingMs > 0 ? new Promise((r) => setTimeout(r, pacingMs)) : Promise.resolve();

  const mark = async (idx: number) => {
    const s = CHECKLIST_STEPS[idx];
    await prisma.bookJob.update({
      where: { id: jobId },
      data: { status: s.status, progress: s.progress, currentStep: s.step },
    });
    await pace();
  };

  const fail = async (step: string, message: string): Promise<void> => {
    await prisma.bookJob.update({
      where: { id: jobId },
      data: { status: JobStatus.failed, currentStep: step, errorMessage: message },
    });
  };

  try {
    // 1. Manuscript analyzed — run the real analyzer when no structure exists
    await mark(0);
    let structure = await prisma.bookStructureJSON.findUnique({ where: { jobId } });
    if (!structure) {
      try {
        await runAnalysisForJob(jobId);
      } catch (analyzerErr) {
        console.error(
          `[Worker] analyzeManuscript failed. Job=${job.id}, Reason=${(analyzerErr as Error)?.message}`
        );
        return fail(
          "Manuscript analysis failed",
          "We couldn't read the structure of this file. Try re-exporting your manuscript as .docx and uploading again."
        );
      }
      structure = await prisma.bookStructureJSON.findUnique({ where: { jobId } });
    }
    const data = structure?.structureData as BookStructureV1 | undefined;
    if (!data) {
      return fail(
        "Manuscript analysis failed",
        "We couldn't read the structure of this file. Try re-exporting your manuscript as .docx and uploading again."
      );
    }

    // 2. Chapters detected — verify there is real content to typeset
    await mark(1);
    if (!hasRenderableContent(data)) {
      return fail(
        "No readable content found",
        "We couldn't find enough text to typeset. If this is a scanned PDF, re-export your manuscript as .docx and try again."
      );
    }

    // 3. Typography applied — resolve template + settings, generate Typst source
    await mark(2);
    const { getTemplate, getEffectiveSettings } = await import("../templates/engine");
    const templateKey = job.templateChoice?.templateKey || "classic";
    const effectiveSettings = getEffectiveSettings(
      getTemplate(templateKey),
      job.settings?.trimSize || (job as any).trimSize || "6x9",
      job.settings || {}
    );
    const { generateTypstSource } = await import("../renderer/typst/generator");
    const { source, images, imageBlockCount } = generateTypstSource({
      jobId,
      structure: data,
      settings: effectiveSettings,
      templateName: templateKey,
      includeColophon: (job.settings as any)?.includeColophon !== false,
    });

    // 4. Layout generated — Typst compiles the interior PDF
    await mark(3);
    const { compileTypst } = await import("../renderer/typst/compiler");
    const { padPdfToMultiple } = await import("../renderer/publication-renderer");
    const fontsDir = path.join(resolveAppRoot(), "src", "lib", "renderer", "fonts");
    const pdfBuffer = await padPdfToMultiple(await compileTypst(source, fontsDir, images), 4);

    // 5. Images checked — every declared image embedded and decodable
    await mark(4);
    const { verifyEmbeddedImages } = await import("../renderer/image-check");
    const imageIssues = verifyEmbeddedImages(images, imageBlockCount);

    // 6. Trim & print checks — real QA: pages exist, trim size matches, text renders
    await mark(5);
    const { runPdfQa } = await import("../renderer/qa");
    const qaResult = await runPdfQa(
      pdfBuffer,
      { jobId, structure: data, settings: effectiveSettings, templateName: templateKey },
      imageIssues
    );
    if (!qaResult.passed) {
      const reasons = qaResult.issues
        .filter((i) => i.level === "error")
        .map((i) => i.description)
        .join(" ");
      return fail(
        "Print checks failed",
        `The generated interior didn't pass print verification. ${reasons || "Please try again."}`
      );
    }

    // 7. Final PDF generated — persist the artifact + the single real QA report
    await mark(6);
    const s3Key = `artifacts/${jobId}/interior_print_ready.pdf`;
    await uploadToStorage(s3Key, pdfBuffer, "application/pdf", "artifacts");

    await prisma.qAReport.create({
      data: {
        jobId,
        score: qaResult.score,
        passed: qaResult.passed,
        pageCount: qaResult.pageCount,
        issues: qaResult.issues as any,
      },
    });

    await prisma.renderArtifact.create({
      data: {
        jobId,
        artifactType: "interior_pdf",
        s3Key,
        s3Bucket: "artifacts",
        fileSizeBytes: pdfBuffer.length,
        downloadUrl: `/api/jobs/${jobId}/download`,
        mimeType: "application/pdf",
      },
    });

    // Free-preview artifact: the same interior rendered with the discreet
    // Typst-side watermark (outer foot margin, content pages only — Typst
    // knows exactly which pages are blanks, part openers, etc.).  This is
    // what unpaid downloads receive; paid exports get the clean artifact.
    try {
      const previewGen = generateTypstSource({
        jobId,
        structure: data,
        settings: effectiveSettings,
        templateName: templateKey,
        preview: true,
        includeColophon: (job.settings as any)?.includeColophon !== false,
      });
      const previewPdf = await padPdfToMultiple(
        await compileTypst(previewGen.source, fontsDir, previewGen.images), 4
      );
      const previewKey = `artifacts/${jobId}/interior_preview.pdf`;
      await uploadToStorage(previewKey, previewPdf, "application/pdf", "artifacts");
      await prisma.renderArtifact.create({
        data: {
          jobId,
          artifactType: "interior_preview_pdf",
          s3Key: previewKey,
          s3Bucket: "artifacts",
          fileSizeBytes: previewPdf.length,
          downloadUrl: `/api/jobs/${jobId}/download`,
          mimeType: "application/pdf",
        },
      });
    } catch (previewErr) {
      // A preview-render failure must never block a finished clean render —
      // the download route falls back to the post-process overlay.
      console.warn(`[Worker] Preview-PDF render skipped for ${jobId}:`, (previewErr as Error).message);
    }

    // In-app page previews (first pages as PNGs) — best effort: a preview
    // failure must never take down a finished book.
    try {
      const previewGen = generateTypstSource({
        jobId,
        structure: truncateStructureForPreview(data),
        settings: effectiveSettings,
        templateName: templateKey,
      });
      const { compileTypstPng } = await import("../renderer/typst/compiler");
      const pagePngs = await compileTypstPng(previewGen.source, fontsDir, previewGen.images, 4);
      for (let i = 0; i < pagePngs.length; i++) {
        const pKey = `artifacts/${jobId}/preview/page-${i + 1}.png`;
        await uploadToStorage(pKey, pagePngs[i], "image/png", "artifacts");
        await prisma.renderArtifact.create({
          data: {
            jobId,
            artifactType: "preview_png",
            s3Key: pKey,
            s3Bucket: "artifacts",
            fileSizeBytes: pagePngs[i].length,
            mimeType: "image/png",
          },
        });
      }
    } catch (previewErr) {
      console.warn(`[Worker] Preview generation skipped for ${jobId}:`, (previewErr as Error).message);
    }

    // EPUB generation (Kindle & Google Play Books ready) — best-effort pre-render
    try {
      const { generateEpub } = await import("../epub/generator");
      const bookTitle = structure?.detectedTitle || job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, "") || "Untitled";
      const bookAuthor = structure?.detectedAuthor || "Author";
      const epubBuffer = await generateEpub({
        title: bookTitle,
        author: bookAuthor,
        structure: data,
      });
      const epubKey = `artifacts/${jobId}/ebook.epub`;
      await uploadToStorage(epubKey, epubBuffer, "application/epub+zip", "artifacts");
      await prisma.renderArtifact.create({
        data: {
          jobId,
          artifactType: "epub",
          s3Key: epubKey,
          s3Bucket: "artifacts",
          fileSizeBytes: epubBuffer.length,
          downloadUrl: `/api/jobs/${jobId}/epub`,
          mimeType: "application/epub+zip",
        },
      });
    } catch (epubErr) {
      console.warn(`[Worker] EPUB pre-render skipped for ${jobId}:`, (epubErr as Error).message);
    }

    // 8. Book ready — artifact exists before this status is visible
    await mark(7);
    logEvent("job_completed", { jobId, pageCount: qaResult.pageCount });
  } catch (err) {
    logError("job_failed", jobId, err as Error);
    await fail("Typesetting failed", `Typesetting failed: ${(err as Error).message}`);
    // Rethrow so BullMQ sees the failure and can apply its retry policy.
    // Without this, the error is swallowed and BullMQ thinks the job
    // succeeded — `attempts: 2` never triggers.
    throw err;
  }
}

// BullMQ worker instance
export let bullWorker: Worker | null = null;

// Starts the queue consumer. Called once from instrumentation.ts at server
// boot (embedded mode) or from scripts/worker.ts (dedicated process).
export function startEmbeddedWorker(): Worker | null {
  if (bullWorker || !redisConnection || process.env.VITEST === "true") {
    return bullWorker;
  }
  try {
    bullWorker = new Worker(
      "book-processing",
      async (job: Job) => {
        const { jobId, task } = job.data || {};
        if (!jobId) return;
        if (task === "analyze") {
          await runAnalysisTask(jobId);
        } else {
          await processBookJob(jobId);
        }
      },
      { connection: redisConnection, concurrency: 2 }
    );
    console.log(`[Worker] Book-processing consumer started (queue: book-processing)`);
    logEvent("worker_started", { concurrency: 2 });
    // 30-day manuscript retention sweep — daily, first run a minute after boot.
    startRetentionSweepTimer();
  } catch (err) {
    console.warn("[BullMQ] Worker initialization deferred:", (err as Error).message);
  }
  return bullWorker;
}
