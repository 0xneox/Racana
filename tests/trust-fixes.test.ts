import { it, expect, describe } from "vitest";
import path from "path";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";
import { generateTypstSource } from "../src/lib/renderer/typst/generator";
import { compileTypst } from "../src/lib/renderer/typst/compiler";
import { resolveAppRoot } from "../src/lib/app-root";
import { runRetentionSweep } from "../src/lib/retention";
import { deleteJobEverywhere } from "../src/lib/jobs/delete";
import prisma from "../src/lib/db";
import type { BookStructureV1 } from "../src/lib/manuscript/types";

const FONTS = path.join(resolveAppRoot(), "src", "lib", "renderer", "fonts");

async function pageTexts(pdf: Buffer): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    out.push(tc.items.map((it: any) => it.str).join(" ").replace(/\s+/g, " ").trim());
  }
  await doc.destroy();
  return out;
}

function structureWithPart(): BookStructureV1 {
  return {
    schemaVersion: 1,
    title: "Part Test",
    author: "Jane Doe",
    chapterCount: 2,
    estimatedPages: 6,
    warnings: [],
    frontMatter: [],
    chapters: [
      {
        number: 0,
        title: "The Break",
        label: "PART TWO",
        kind: "part",
        subtitle: "What gives way, and what it shows",
        wordCount: 40,
        sections: [
          { title: "", blocks: [{ type: "paragraph", text: "This part is about the gap between seeing and living." }] },
        ],
      },
      {
        number: 6,
        title: "Why Insight Fails",
        label: "CHAPTER SIX",
        wordCount: 50,
        sections: [{ title: "", blocks: [{ type: "paragraph", text: "Chapter six opens here." }] }],
      },
    ],
    backMatter: [],
  };
}

describe("typst: part divider is a closed display page", () => {
  it("keeps part description off the divider and the chapter opener on its own page", async () => {
    const settings = getEffectiveSettings(getTemplate("classic"), "trim_6x9", {});
    const { source } = generateTypstSource({
      jobId: "part-test",
      structure: structureWithPart(),
      settings,
      templateName: "classic",
    });
    const pdf = await compileTypst(source, FONTS);
    const pages = await pageTexts(pdf);

    const partPage = pages.findIndex((p) => /P\s*A\s*R\s*T\s+T\s*W\s*O/.test(p) && p.includes("The Break"));
    expect(partPage).toBeGreaterThanOrEqual(0);
    // The divider page must not carry the part's body text or the next chapter.
    expect(pages[partPage]).not.toContain("gap between seeing and living");
    expect(pages[partPage]).not.toContain("Why Insight Fails");

    // Locate the real chapter opener by its body text — the ToC also lists
    // the chapter title and would false-match a naive title search.
    const chapterPage = pages.findIndex((p) => p.includes("Chapter six opens here."));
    expect(chapterPage).toBeGreaterThan(partPage);
    expect(pages[chapterPage]).toContain("Why Insight Fails");
    // Chapter opener does not share its page with part content.
    expect(pages[chapterPage]).not.toContain("gap between seeing and living");
  }, 60000);
});

describe("typst: no Racana ad on the copyright page", () => {
  const base: BookStructureV1 = {
    schemaVersion: 1,
    title: "Brand Free",
    author: "Jane Doe",
    chapterCount: 1,
    estimatedPages: 4,
    warnings: [],
    frontMatter: [],
    chapters: [
      {
        number: 1,
        title: "One",
        wordCount: 40,
        sections: [{ title: "", blocks: [{ type: "paragraph", text: "Body text." }] }],
      },
    ],
    backMatter: [],
  };

  it("keeps Racana out of the copyright block; colophon is optional", async () => {
    const settings = getEffectiveSettings(getTemplate("classic"), "trim_6x9", {});

    const { source: withColophon } = generateTypstSource({
      jobId: "brand-test",
      structure: base,
      settings,
      templateName: "classic",
      includeColophon: true,
    });
    const pages = await pageTexts(await compileTypst(withColophon, FONTS));
    const copyrightPage = pages.find((p) => p.includes("All rights reserved"));
    expect(copyrightPage).toBeDefined();
    expect(copyrightPage).not.toContain("Typeset by Racana");
    expect(copyrightPage).not.toContain("racana.pro");
    // The colophon still exists by default — at the very end, its own page.
    expect(pages[pages.length - 1]).toContain("Typeset by Racana");

    const { source: noColophon } = generateTypstSource({
      jobId: "brand-test",
      structure: base,
      settings,
      templateName: "classic",
      includeColophon: false,
    });
    const pages2 = await pageTexts(await compileTypst(noColophon, FONTS));
    expect(pages2.every((p) => !p.includes("Typeset by Racana"))).toBe(true);
  }, 60000);
});

describe("deletion: retention sweep and job delete", () => {
  it("purges manuscript rows past the 30-day retention window", async () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const asset = await prisma.manuscriptAsset.create({
      data: {
        jobId: "retention-job",
        fileName: "old.docx",
        s3Key: "uploads/retention-job/old.docx",
        s3Bucket: "manuscripts",
        createdAt: old,
      },
    });
    const fresh = await prisma.manuscriptAsset.create({
      data: {
        jobId: "retention-job-2",
        fileName: "new.docx",
        s3Key: "uploads/retention-job-2/new.docx",
        s3Bucket: "manuscripts",
      },
    });
    const purged = await runRetentionSweep();
    expect(purged).toBeGreaterThanOrEqual(1);
    const after = await prisma.manuscriptAsset.findMany({ where: { jobId: "retention-job" } });
    expect(after[0]?.deletedAt).toBeTruthy();
    const freshAfter = await prisma.manuscriptAsset.findMany({ where: { jobId: "retention-job-2" } });
    expect(freshAfter[0]?.deletedAt ?? null).toBeNull();
    await prisma.manuscriptAsset.deleteMany({ where: { jobId: "retention-job" } });
    await prisma.manuscriptAsset.deleteMany({ where: { jobId: "retention-job-2" } });
  });

  it("deleteJobEverywhere removes the job and its children", async () => {
    const job = await prisma.bookJob.create({
      data: {
        status: "ready",
        manuscriptAsset: { create: { fileName: "del.docx", s3Key: "uploads/x/del.docx" } },
        structureJson: { create: { detectedTitle: "Del", structureData: {} } },
        artifacts: { create: { artifactType: "interior_pdf", s3Key: "artifacts/x/interior.pdf" } },
      },
    });
    await deleteJobEverywhere(job.id);
    expect(await prisma.bookJob.findUnique({ where: { id: job.id } })).toBeNull();
    expect(await prisma.renderArtifact.findMany({ where: { jobId: job.id } })).toHaveLength(0);
    expect(await prisma.bookStructureJSON.findUnique({ where: { jobId: job.id } })).toBeNull();
  });
});
