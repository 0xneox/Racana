import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import type { RendererOptions, QAReportResult, QAIssue } from "./types";
import { interiorBleedMm } from "./typst/generator";

// Expected physical page size per trim, in PDF points (1pt = 1/72in).
const TRIM_SIZE_PT: Record<string, [number, number]> = {
  "5x8": [360, 576],
  "5.5x8.5": [396, 612],
  "6x9": [432, 648],
  "8.5x11": [612, 792],
};
const TRIM_TOLERANCE_PT = 2;

// KDP paperback page-count limits (black-ink interiors).
const KDP_MIN_PAGES = 24;
const KDP_MAX_PAGES = 828;

// KDP minimum inside (gutter) margin by page count, in inches.
const KDP_GUTTER_IN: [maxPages: number, inches: number][] = [
  [150, 0.375],
  [300, 0.5],
  [500, 0.625],
  [700, 0.75],
  [Infinity, 0.875],
];
// Outside/top/bottom minimum, measured from the trim line.
const KDP_OUTER_MIN_IN = 0.25;
const KDP_OUTER_MIN_BLEED_IN = 0.375;
const MM_PER_IN = 25.4;

function pageCountIssues(pageCount: number): QAIssue[] {
  if (pageCount > 0 && pageCount < KDP_MIN_PAGES) {
    return [{ code: "PAGE_COUNT_BELOW_MIN", level: "error", description: `${pageCount} pages is below KDP's ${KDP_MIN_PAGES}-page paperback minimum.` }];
  }
  if (pageCount > KDP_MAX_PAGES) {
    return [{ code: "PAGE_COUNT_ABOVE_MAX", level: "error", description: `${pageCount} pages is above KDP's ${KDP_MAX_PAGES}-page paperback maximum — reduce the font size or split the book.` }];
  }
  return [];
}

export function kdpMinGutterMm(pageCount: number): number {
  const row = KDP_GUTTER_IN.find(([max]) => pageCount <= max)!;
  return row[1] * MM_PER_IN;
}

function marginIssues(options: RendererOptions, pageCount: number): QAIssue[] {
  const m = options?.settings?.margins;
  if (!m || pageCount <= 0) return [];
  const issues: QAIssue[] = [];
  const gutter = kdpMinGutterMm(pageCount);
  if (m.insideMm + 0.05 < gutter) {
    issues.push({
      code: "GUTTER_TOO_NARROW",
      level: "error",
      description: `Inside margin ${m.insideMm.toFixed(1)}mm is below KDP's ${gutter.toFixed(1)}mm (${(gutter / MM_PER_IN).toFixed(3)}″) minimum for ${pageCount} pages — text would disappear into the spine.`,
    });
  }
  const outerMin = (interiorBleedMm(options.settings) > 0 ? KDP_OUTER_MIN_BLEED_IN : KDP_OUTER_MIN_IN) * MM_PER_IN;
  const narrow = (["outsideMm", "topMm", "bottomMm"] as const).filter((k) => m[k] + 0.05 < outerMin);
  if (narrow.length) {
    issues.push({
      code: "MARGIN_TOO_NARROW",
      level: "error",
      description: `${narrow.map((k) => `${k.replace("Mm", "")} ${m[k].toFixed(1)}mm`).join(", ")} below KDP's ${outerMin.toFixed(2)}mm minimum.`,
    });
  }
  if (!issues.length) {
    issues.push({ code: "MARGINS_VERIFIED", level: "info", description: `Margins meet KDP minimums for ${pageCount} pages (gutter ≥ ${gutter.toFixed(1)}mm).` });
  }
  return issues;
}

// Every font must carry its glyph data. Font descriptors need a FontFile*
// stream; simple fonts without a descriptor are the unembedded "standard 14".
// Type 3 fonts define glyphs inline and Type 0 parents defer to descendants.
function fontEmbeddingIssues(doc: PDFDocument): QAIssue[] {
  const missing = new Set<string>();
  let fonts = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    const type = obj.get(PDFName.of("Type"));
    const name = String(obj.get(PDFName.of("FontName")) ?? obj.get(PDFName.of("BaseFont")) ?? "?").replace(/^\//, "");
    if (type === PDFName.of("FontDescriptor")) {
      fonts++;
      const embedded = ["FontFile", "FontFile2", "FontFile3"].some((k) => obj.has(PDFName.of(k)));
      if (!embedded) missing.add(name);
    } else if (type === PDFName.of("Font")) {
      const subtype = obj.get(PDFName.of("Subtype"));
      const simple = subtype === PDFName.of("Type1") || subtype === PDFName.of("TrueType") || subtype === PDFName.of("MMType1");
      if (simple && !obj.has(PDFName.of("FontDescriptor"))) missing.add(name);
    }
  }
  if (missing.size) {
    return [{ code: "FONT_NOT_EMBEDDED", level: "error", description: `Fonts not embedded: ${[...missing].join(", ")}. KDP requires every font to be embedded.` }];
  }
  return [{ code: "FONTS_EMBEDDED", level: "info", description: `All ${fonts} font(s) are embedded.` }];
}

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
    const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
    pageCount = doc.getPageCount();

    const trim = TRIM_SIZE_PT[options?.settings?.trimSize || ""];
    // Interior bleed adds 0.125″ to the outside edge and to top and bottom.
    const bleedPt = (interiorBleedMm(options.settings) / 25.4) * 72;
    const expected = trim && [trim[0] + bleedPt, trim[1] + 2 * bleedPt];
    const label = `${options.settings?.trimSize}${bleedPt > 0 ? " + 0.125″ bleed" : ""}`;
    const first = doc.getPage(0);
    if (expected && first) {
      // Every page, not just the first — a single odd-sized page is a KDP rejection.
      const bad = doc.getPages().findIndex((p) => {
        const { width, height } = p.getSize();
        return Math.abs(width - expected[0]) > TRIM_TOLERANCE_PT || Math.abs(height - expected[1]) > TRIM_TOLERANCE_PT;
      });
      if (bad >= 0) {
        const { width, height } = doc.getPage(bad).getSize();
        issues.push({
          code: "TRIM_MISMATCH",
          level: "error",
          description: `Page ${bad + 1} is ${width.toFixed(1)}×${height.toFixed(1)}pt, expected ${label} (${expected[0].toFixed(1)}×${expected[1].toFixed(1)}pt).`,
        });
      } else {
        issues.push({
          code: "TRIM_VERIFIED",
          level: "info",
          description: `Page size matches ${label} specification.`,
        });
      }
    }

    issues.push(...pageCountIssues(pageCount));
    issues.push(...marginIssues(options, pageCount));
    issues.push(...fontEmbeddingIssues(doc));
  } catch (err) {
    issues.push({
      code: "PDF_PARSE_FAILED",
      level: "error",
      description: `Could not parse generated PDF: ${(err as Error).message}`,
    });
  }

  // Text extraction check — a typeset interior must contain selectable text.
  try {
    const { extractTextWithPdfjs } = await import("../manuscript/pdf-parser");
    const { text } = await extractTextWithPdfjs(pdfBuffer);
    textLength = text.replace(/\s+/g, "").length;
    textChecked = true;
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
