import { resolvePdfWorker } from "../pdf-worker";
import type { RendererOptions, QAReportResult, QAIssue } from "./types";

// Expected physical page size per trim, in PDF points (1pt = 1/72in).
const TRIM_SIZE_PT: Record<string, [number, number]> = {
  "5x8": [360, 576],
  "5.5x8.5": [396, 612],
  "6x9": [432, 648],
  "8.5x11": [612, 792],
};
const TRIM_TOLERANCE_PT = 2;

export async function runPdfQa(
  pdfBuffer: Buffer,
  options: RendererOptions,
  extraIssues: QAIssue[] = []
): Promise<QAReportResult> {
  const issues: QAIssue[] = [...extraIssues];
  let pageCount = 0;
  let textLength = 0;
  let textChecked = false;

  if (!pdfBuffer || pdfBuffer.length === 0) {
    issues.push({ code: "EMPTY_PDF", level: "error", description: "PDF buffer is empty." });
    return { passed: false, score: 0, pageCount: 0, issues };
  }

  if (pdfBuffer.toString("binary", 0, 4) !== "%PDF") {
    issues.push({ code: "INVALID_MAGIC", level: "error", description: "Missing %PDF magic header." });
    return { passed: false, score: 0, pageCount: 0, issues };
  }

  if (pdfBuffer.length < 5000) {
    issues.push({ code: "PDF_TOO_SMALL", level: "error", description: "Generated PDF is suspiciously small (likely placeholder)." });
  }

  // Structural verification via pdf-lib: real page count + physical trim size.
  try {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    pageCount = doc.getPageCount();

    const expected = TRIM_SIZE_PT[options?.settings?.trimSize || ""];
    const first = doc.getPage(0);
    if (expected && first) {
      const { width, height } = first.getSize();
      const dw = Math.abs(width - expected[0]);
      const dh = Math.abs(height - expected[1]);
      if (dw > TRIM_TOLERANCE_PT || dh > TRIM_TOLERANCE_PT) {
        issues.push({
          code: "TRIM_MISMATCH",
          level: "error",
          description: `Page size ${width.toFixed(1)}×${height.toFixed(1)}pt does not match expected trim ${options.settings.trimSize} (${expected[0]}×${expected[1]}pt).`,
        });
      } else {
        issues.push({
          code: "TRIM_VERIFIED",
          level: "info",
          description: `Page size matches ${options.settings.trimSize} trim specification.`,
        });
      }
    }
  } catch (err) {
    issues.push({
      code: "PDF_PARSE_FAILED",
      level: "error",
      description: `Could not parse generated PDF: ${(err as Error).message}`,
    });
  }

  // Text extraction check — a typeset interior must contain selectable text.
  try {
    const mod: any = await import("pdf-parse");
    const PDFParse = mod.PDFParse || mod.default?.PDFParse || mod.default;
    const workerPath = resolvePdfWorker();
    if (workerPath && typeof PDFParse.setWorker === "function") {
      PDFParse.setWorker(workerPath);
    }
    const parser = new PDFParse({ data: new Uint8Array(pdfBuffer) });
    try {
      const textResult = await parser.getText();
      textLength = (textResult?.text || "").replace(/\s+/g, "").length;
      textChecked = true;
    } finally {
      await parser.destroy?.().catch(() => {});
    }
  } catch (err) {
    issues.push({
      code: "PDF_TEXT_CHECK_SKIPPED",
      level: "warning",
      description: `Text extraction unavailable (${(err as Error).message}); verified page structure only.`,
    });
  }

  if (pageCount <= 0) {
    issues.push({ code: "NO_PAGES", level: "error", description: "PDF contains no pages." });
  }

  if (textChecked && textLength < 50) {
    issues.push({ code: "NO_TEXT", level: "error", description: "PDF has no extractable text (possible blank render)." });
  }

  const hardFails = issues.filter((i) => i.level === "error").length;
  const warnings = issues.filter((i) => i.level === "warning").length;
  const passed = hardFails === 0;
  const score = passed ? Math.max(60, 100 - warnings * 5) : Math.max(0, 40 - hardFails * 15);

  return { passed, score, pageCount, issues };
}
