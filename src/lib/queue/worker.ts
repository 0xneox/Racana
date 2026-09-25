import { Worker, Job } from "bullmq";
import path from "path";
import { redisConnection } from "./queue";
import prisma from "../db";
import { JobStatus, BookType } from "@prisma/client";
import { getFromStorage, uploadToStorage } from "../storage/s3";
import { analyzeManuscript } from "../ai/analyzer";
import { resolveAppRoot } from "../app-root";
import type { BookStructureV1, Block } from "../manuscript/types";

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
    console.error(`[Worker] Analysis task failed. Job=${jobId}, Reason=${(err as Error)?.message}`);
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
  console.log(`[Worker] Starting processing for Job ID: ${jobId}`);

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
    });

    // 4. Layout generated — Typst compiles the interior PDF
    await mark(3);
    const { compileTypst } = await import("../renderer/typst/compiler");
    const fontsDir = path.join(resolveAppRoot(), "src", "lib", "renderer", "fonts");
    const pdfBuffer = await compileTypst(source, fontsDir, images);

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

    // 8. Book ready — artifact exists before this status is visible
    await mark(7);
    console.log(`[Worker] Finished processing for Job ID: ${jobId} -> Status: ready`);
  } catch (err) {
    console.error(`[Worker] Processing failed for Job ID: ${jobId}`, err);
    await fail("Typesetting failed", `Typesetting failed: ${(err as Error).message}`);
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
    console.log("[Worker] Book-processing consumer started (queue: book-processing)");
  } catch (err) {
    console.warn("[BullMQ] Worker initialization deferred:", (err as Error).message);
  }
  return bullWorker;
}
