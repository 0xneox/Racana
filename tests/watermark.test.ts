import { it, expect } from "vitest";
import { addWatermarkOverlayToPdf } from "../src/lib/watermark";
import { generatePublication } from "../src/lib/renderer/publication-renderer";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";
import { analyzeManuscript } from "../src/lib/ai/analyzer";
import fs from "fs";

it("applies a real diagonal watermark to a rendered PDF", async () => {
  const buf = fs.readFileSync("tests/fixtures/novel_chapters.docx");
  const structure = await analyzeManuscript(buf, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "novel_chapters.docx");
  const tpl = getTemplate("classic");
  const settings = getEffectiveSettings(tpl, "trim_6x9", {});
  const { pdfBuffer } = await generatePublication({
    jobId: "wm-test",
    structure: structure as any,
    settings,
    templateName: "classic",
  });

  const marked = await addWatermarkOverlayToPdf(pdfBuffer, "RACANA · FREE PREVIEW");
  expect(marked.slice(0, 5).toString()).toBe("%PDF-");
  expect(marked.length).toBeGreaterThan(pdfBuffer.length * 0.8);
  // Watermark draws content streams — stamped PDF should differ from original
  expect(marked.equals(pdfBuffer)).toBe(false);
  fs.writeFileSync("test-watermarked.pdf", marked);
  console.log(`original=${pdfBuffer.length}B watermarked=${marked.length}B`);
}, 120000);
