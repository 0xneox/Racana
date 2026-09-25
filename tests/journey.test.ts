import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "../src/lib/db";
import { processBookJob, CHECKLIST_STEPS } from "../src/lib/queue/worker";
import { BookType, JobStatus, TemplateKey, TrimSize } from "@prisma/client";
import { getFromStorage, uploadToStorage } from "../src/lib/storage/s3";
import fs from "fs";
import path from "path";

describe("User Journey E2E Flow Test", () => {
  let testJobId: string;
  const fixturePath = path.join(__dirname, "fixtures", "novel_chapters.docx");
  const fixtureBuffer = fs.readFileSync(fixturePath);

  beforeAll(async () => {
    // Place the real fixture manuscript in storage so the analyzer reads actual bytes
    await uploadToStorage(
      "uploads/test/novel_chapters.docx",
      fixtureBuffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "manuscripts"
    );

    // Create test user and initial uploaded book job
    const user = await prisma.user.create({
      data: {
        email: `tester_${Date.now()}@example.com`,
        name: "Test Author",
      },
    });

    const job = await prisma.bookJob.create({
      data: {
        userId: user.id,
        status: JobStatus.uploaded,
        progress: 0,
        currentStep: "uploaded",
        bookType: BookType.novel,
        trimSize: TrimSize.trim_6x9,
        manuscriptAsset: {
          create: {
            fileName: "novel_chapters.docx",
            fileSizeBytes: fixtureBuffer.length,
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            s3Key: "uploads/test/novel_chapters.docx",
            s3Bucket: "manuscripts",
            pageCountEstimate: 140,
            wordCountEstimate: 47000,
          },
        },
        templateChoice: {
          create: {
            templateKey: TemplateKey.classic,
            name: "Classic",
            personality: "Timeless Literary",
            description: "Traditional Garamond typography with elegant drop caps.",
          },
        },
        settings: {
          create: {
            trimSize: TrimSize.trim_6x9,
          },
        },
      },
    });

    testJobId = job.id;
  });

  it("Step 1 & 2: Should retrieve uploaded job and customize template choice", async () => {
    const job = await prisma.bookJob.findUnique({
      where: { id: testJobId },
      include: { manuscriptAsset: true, templateChoice: true },
    });

    expect(job).toBeDefined();
    expect(job?.manuscriptAsset?.fileName).toBe("novel_chapters.docx");

    // Simulate user choosing Philosophy template on /templates
    await prisma.templateChoice.update({
      where: { jobId: testJobId },
      data: {
        templateKey: TemplateKey.philosophy,
        name: "Philosophy",
        personality: "Spacious Contemplative",
        description: "Generous margins for contemplative breathing room.",
      },
    });

    const updated = await prisma.templateChoice.findUnique({
      where: { jobId: testJobId },
    });
    expect(updated?.templateKey).toBe(TemplateKey.philosophy);
  });

  it("Step 3: Should customize trim size and settings on /settings", async () => {
    await prisma.bookJob.update({
      where: { id: testJobId },
      data: { trimSize: TrimSize.trim_5_5x8_5 },
    });

    await prisma.bookSettings.update({
      where: { jobId: testJobId },
      data: {
        trimSize: TrimSize.trim_5_5x8_5,
        runningHeaders: true,
        chapterOpenRecto: true,
      },
    });

    const updated = await prisma.bookJob.findUnique({
      where: { id: testJobId },
      include: { settings: true },
    });
    expect(updated?.trimSize).toBe(TrimSize.trim_5_5x8_5);
    expect(updated?.settings?.chapterOpenRecto).toBe(true);
  });

  it("Step 4: Should execute worker pipeline through all 8 checklist steps to ready state", { timeout: 120000 }, async () => {
    // Run worker process for the test job (fast mode: 20ms per step)
    await processBookJob(testJobId, 20);

    const completedJob = await prisma.bookJob.findUnique({
      where: { id: testJobId },
      include: {
        artifacts: true,
        qaReports: true,
        structureJson: true,
      },
    });

    expect(completedJob?.status).toBe(JobStatus.ready);
    expect(completedJob?.progress).toBe(100);
    expect(completedJob?.currentStep).toBe("Book ready");

    // Verify real structure detection on the fixture (3 real chapters, not a stub)
    expect(completedJob?.structureJson).toBeDefined();
    expect(completedJob?.structureJson?.chapterCount).toBe(3);

    // Verify QA report
    expect(completedJob?.qaReports.length).toBeGreaterThan(0);
    expect(completedJob?.qaReports[0].passed).toBe(true);
    expect(completedJob?.qaReports[0].score).toBe(100);

    // Verify PDF RenderArtifact generated
    expect(completedJob?.artifacts.length).toBeGreaterThan(0);
    const interiorPdf = (completedJob?.artifacts as any[])?.find(
      (a: any) => a.artifactType === "interior_pdf"
    );
    expect(interiorPdf).toBeDefined();
    expect(interiorPdf?.s3Bucket).toBe("artifacts");
  });

  it("Step 5: Should retrieve generated PDF from storage and verify PDF integrity", { timeout: 60000 }, async () => {
    const job = await prisma.bookJob.findUnique({
      where: { id: testJobId },
      include: { artifacts: true },
    });
    const artifact = (job?.artifacts as any[])?.find((a: any) => a.artifactType === "interior_pdf");
    expect(artifact).toBeDefined();

    const pdfBuffer = await getFromStorage(artifact!.s3Key, artifact!.s3Bucket);
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(100);

    // Verify PDF header magic bytes %PDF
    const header = pdfBuffer.slice(0, 5).toString("utf-8");
    expect(header).toBe("%PDF-");
  });

  it("Step 6: Should create EmailLog when author requests email delivery on /ready", async () => {
    const log = await prisma.emailLog.create({
      data: {
        jobId: testJobId,
        recipientEmail: "author@example.com",
        subject: "Your print-ready book interior",
        status: "sent",
        resendMessageId: "resend_test_123",
      },
    });

    expect(log.id).toBeDefined();
    expect(log.status).toBe("sent");

    const found = await prisma.emailLog.findUnique({ where: { id: log.id } });
    expect(found?.recipientEmail).toBe("author@example.com");
  });
});
