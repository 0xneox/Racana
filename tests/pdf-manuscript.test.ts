import { describe, it, expect } from "vitest";
import fs from "fs";
import { analyzeManuscript } from "../src/lib/ai/analyzer";
import { generatePublication } from "../src/lib/renderer/publication-renderer";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";

describe("PDF manuscript parsing", () => {
  it("extracts structure from a real PDF", async () => {
    const buf = fs.readFileSync("tests/fixtures/pdf_manuscript.pdf");
    const s = await analyzeManuscript(buf, "application/pdf", "pdf_manuscript.pdf");
    console.log("title:", s.title, "| author:", s.author, "| type:", s.detectedBookType);
    console.log("chapters:", s.chapterCount, "| estPages:", s.estimatedPages);
    console.log("titles:", s.chapters.map((c: any) => c.title));
    expect(s.chapterCount).toBeGreaterThanOrEqual(3);
    expect(s.chapters[0].wordCount).toBeGreaterThan(50);
  });
  it("renders a PDF-sourced manuscript all the way through the engine and passes QA", async () => {
    const buf = fs.readFileSync("tests/fixtures/pdf_manuscript.pdf");
    const structure = await analyzeManuscript(buf, "application/pdf", "pdf_manuscript.pdf");
    const settings = getEffectiveSettings(getTemplate("classic"), "6x9", {
      trimSize: "trim_6x9",
    });

    const result = await generatePublication({
      jobId: "test-pdf-render",
      structure,
      settings,
      templateName: "classic",
    });

    expect(result.pdfBuffer).toBeDefined();
    expect(result.qaResult.passed).toBe(true);
    expect(result.qaResult.pageCount).toBeGreaterThan(0);
    expect(result.qaResult.pageCount % 4).toBe(0); // padded to multiple of 4
  }, 120_000);

  it("generates a valid EPUB from the PDF manuscript structure", async () => {
    const { buildEpub } = await import("../src/lib/epub/generator");
    const { validateEpub } = await import("../src/lib/epub/validate");
    const buf = fs.readFileSync("tests/fixtures/pdf_manuscript.pdf");
    const structure = await analyzeManuscript(buf, "application/pdf", "pdf_manuscript.pdf");

    const { buffer, warnings } = await buildEpub({
      title: structure.title || "The Lighthouse Keeper",
      author: structure.author || "Eleanor Vance",
      identifier: "urn:uuid:test-pdf-epub",
      structure,
    });

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(1000);
    const issues = await validateEpub(buffer);
    expect(issues).toHaveLength(0);
  });
});
