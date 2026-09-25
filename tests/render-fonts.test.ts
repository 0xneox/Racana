import { it, expect } from "vitest";
import { generatePublication } from "../src/lib/renderer/publication-renderer";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";
import { analyzeManuscript } from "../src/lib/ai/analyzer";
import fs from "fs";

it("renders PDFs for all 6 templates with embedded fonts", async () => {
  const buf = fs.readFileSync("tests/fixtures/philosophy_meditations.docx");
  const structure = await analyzeManuscript(buf, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "philosophy_meditations.docx");

  for (const key of ["classic", "modern", "philosophy", "academic", "literary", "indian"] as const) {
    const tpl = getTemplate(key);
    const settings = getEffectiveSettings(tpl, "trim_6x9", {});
    const { pdfBuffer, qaResult } = await generatePublication({
      jobId: `font-test-${key}`,
      structure: structure as any,
      settings,
      templateName: key,
    });
    const head = pdfBuffer.slice(0, 5).toString();
    // Check embedded font name appears in the PDF font table
    const bodyFont = settings.body.fontFamily;
    const hasFont = pdfBuffer.includes(Buffer.from(bodyFont)) ||
                    pdfBuffer.includes(Buffer.from(bodyFont.replace(/ /g, ""))) ||
                    pdfBuffer.includes(Buffer.from(bodyFont.replace(/ /g, "-")));
    console.log(`${key}: ${pdfBuffer.length}B, pages=${qaResult.pageCount}, font="${bodyFont}" embedded=${hasFont}`);
    expect(head).toBe("%PDF-");
    expect(qaResult.passed).toBe(true);
    expect(qaResult.pageCount).toBeGreaterThan(0);
    expect(hasFont).toBe(true);
  }
}, 180000);
