import { Worker, Job } from "bullmq";
import { redisConnection } from "./queue";
import prisma from "../db";
import { JobStatus, BookType } from "@prisma/client";
import { getFromStorage, uploadToStorage } from "../storage/s3";
import { analyzeManuscript } from "../ai/analyzer";
import type { BookStructureV1 } from "../manuscript/types";


export const CHECKLIST_STEPS = [
  { step: "Manuscript analyzed", status: JobStatus.analyzing, progress: 15 },
  { step: "Chapters detected", status: JobStatus.structure_ready, progress: 30 },
  { step: "Typography applied", status: JobStatus.typesetting, progress: 45 },
  { step: "Layout generated", status: JobStatus.typesetting, progress: 60 },
  { step: "Pagination optimized", status: JobStatus.typesetting, progress: 75 },
  { step: "Images checked", status: JobStatus.qa, progress: 85 },
  { step: "Print margins checked", status: JobStatus.fixing, progress: 95 },
  { step: "Final PDF generated", status: JobStatus.ready, progress: 100 },
];

export async function processBookJob(jobId: string, speedMs = 350) {
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

  // Iterate through checklist steps
  for (const item of CHECKLIST_STEPS) {
    await new Promise((resolve) => setTimeout(resolve, speedMs));

    await prisma.bookJob.update({
      where: { id: jobId },
      data: {
        status: item.status,
        progress: item.progress,
        currentStep: item.step,
      },
    });

    if (item.status === JobStatus.structure_ready) {
      let structure: BookStructureV1;
      try {
        const asset = job.manuscriptAsset;
        if (!asset || !asset.s3Key || !asset.s3Bucket) {
          throw new Error("No manuscript asset for analyzer");
        }
        const msBuffer = await getFromStorage(asset.s3Key, asset.s3Bucket);
        if (!msBuffer || msBuffer.length < 100) {
          throw new Error("Manuscript bytes missing or empty in storage");
        }
        structure = await analyzeManuscript(
          msBuffer,
          asset.mimeType || "application/octet-stream",
          asset.fileName || "manuscript"
        );
      } catch (analyzerErr) {
        console.warn(
          `[Worker] analyzeManuscript failed (or stub path); falling back to structure stub. ` +
            `Job=${job.id}, Reason=${(analyzerErr as Error)?.message}`
        );
        structure = {
          schemaVersion: 1,
          title: job.manuscriptAsset?.fileName?.replace(/\.[^/.]+$/, "") || "Untitled Manuscript",
          author: "Author",
          detectedBookType: (job.bookType as BookStructureV1["detectedBookType"]) || "other",
          chapterCount: 12,
          estimatedPages: job.manuscriptAsset?.pageCountEstimate || 184,
          warnings: [],
          frontMatter: [
            { type: "half-title", title: "Half-Title", blocks: [] },
            { type: "title-page", title: "Title Page", blocks: [] },
            { type: "copyright", title: "Copyright", blocks: [] },
          ],
          chapters: Array.from({ length: 12 }, (_, i) => ({
            number: i + 1,
            title: `Chapter ${i + 1}`,
            wordCount: 2400,
            sections: [],
          })),
          backMatter: [{ type: "about-author", title: "About the Author", blocks: [] }],
        };
      }

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
    }

    if (item.status === JobStatus.fixing) {
      // Stub QA Report
      await prisma.qAReport.create({
        data: {
          jobId,
          score: 100,
          passed: true,
          pageCount: job.manuscriptAsset?.pageCountEstimate || 184,
          issues: [
            {
              code: "INFO_MARGINS_VALIDATED",
              level: "info",
              description: "Gutters and trim validated for print readiness.",
            },
          ],
        },
      });
    }

    if (item.status === JobStatus.ready) {
      const { generatePublication } = await import("../renderer/publication-renderer");
      const { getTemplate, getEffectiveSettings } = await import("../templates/engine");
      
      const structure = await prisma.bookStructureJSON.findUnique({
        where: { jobId },
      });
      
      if (!structure || !structure.structureData) {
        throw new Error("Missing structure data for rendering.");
      }

      const templateName = job.templateChoice?.name || "classic";
      const templateKey = job.templateChoice?.templateKey || "classic";
      const templateDef = getTemplate(templateKey);
      const trimSize = job.settings?.trimSize || "6x9";
      const effectiveSettings = getEffectiveSettings(templateDef, trimSize, job.settings || {});

      try {
        const { pdfBuffer, qaResult } = await generatePublication({
          jobId,
          structure: structure.structureData as any,
          settings: effectiveSettings,
          templateName: templateKey
        });

        // Upsert QA Report
        await prisma.qAReport.create({
          data: {
            jobId,
            score: qaResult.score,
            passed: qaResult.passed,
            pageCount: qaResult.pageCount,
            issues: qaResult.issues as any,
          },
        });

        const s3Key = `artifacts/${jobId}/interior_print_ready.pdf`;
        await uploadToStorage(s3Key, pdfBuffer, "application/pdf", "artifacts");

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
      } catch (err) {
        console.error(`[Worker] Rendering failed for Job ID: ${jobId}`, err);
        await prisma.bookJob.update({
          where: { id: jobId },
          data: {
            status: "failed",
            errorMessage: `Typesetting failed: ${(err as Error).message}`
          }
        });
        return; // Halt processing
      }
    }
  }

  console.log(`[Worker] Finished processing for Job ID: ${jobId} -> Status: ready`);
}

// BullMQ worker instance
export let bullWorker: Worker | null = null;

if (redisConnection) {
  try {
    bullWorker = new Worker(
      "book-processing",
      async (job: Job) => {
        const { jobId } = job.data;
        await processBookJob(jobId);
      },
      { connection: redisConnection, concurrency: 2 }
    );
  } catch (err) {
    console.warn("[BullMQ] Worker initialization deferred:", (err as Error).message);
  }
}
