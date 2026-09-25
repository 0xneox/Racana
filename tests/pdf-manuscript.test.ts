import { describe, it, expect } from "vitest";
import fs from "fs";
import { analyzeManuscript } from "../src/lib/ai/analyzer";

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
});
