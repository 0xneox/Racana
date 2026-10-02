// Free-preview watermark — fallback path for interior PDFs rendered before
// the Typst-side `previewWatermark` pipeline existed.  Current renders carry
// their own watermark variant (see worker.ts: interior_preview_pdf), so this
// only runs for legacy artifacts.
//
// Spec: a single discreet line in the outer foot margin, 6.5pt, 40% grey,
// only on pages that carry content — never on blanks, the title page, the
// copyright page, or part openers.  Paid export removes it entirely (the
// route simply serves the clean artifact).
//
// Fail-closed: if the overlay fails for any reason, we throw rather than
// returning the unwatermarked PDF.  Returning a clean PDF on error would
// give free users a print-ready file with no watermark.

const BRAND_DOMAIN = (process.env.BRAND_DOMAIN || "racana.pro").trim() || "racana.pro";

// Pages that must never carry the watermark: the first three (half-title,
// title, copyright) and any page whose text content is empty (blank versos)
// or looks like a part opener ("PART ONE" + title + subtitle only).
function looksLikePartOpener(pageText: string): boolean {
  const t = pageText.trim();
  if (!t || t.length > 300) return false;
  return /^part\b/i.test(t.split("\n").find((l) => l.trim()) || "");
}

async function pageHasText(buffer: Buffer): Promise<boolean[]> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
  try {
    const flags: boolean[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map((it: any) => it?.str || "").join("");
      flags.push(text.trim().length > 0);
      page.cleanup?.();
    }
    return flags;
  } finally {
    await doc.destroy?.().catch(() => {});
  }
}

export async function addWatermarkOverlayToPdf(
  originalPdf: Buffer,
  watermarkText: string
): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.load(originalPdf, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pages = pdfDoc.getPages();

  let textFlags: boolean[] = [];
  try {
    textFlags = await pageHasText(originalPdf);
  } catch {
    // pdfjs unavailable — fall back to marking every page except the first 3.
    textFlags = pages.map((_, i) => i >= 3);
  }

  // Extract per-page text for the part-opener check (best-effort).
  const { extractTextWithPdfjs } = await import("./manuscript/pdf-parser").catch(() => ({ extractTextWithPdfjs: null as any }));
  let pageTexts: string[] = [];
  if (extractTextWithPdfjs) {
    try {
      const { text } = await extractTextWithPdfjs(originalPdf);
      pageTexts = text.split("\f");
    } catch {
      pageTexts = [];
    }
  }

  const line = `${watermarkText} · ${BRAND_DOMAIN}`;
  const size = 6.5;
  const grey = rgb(0.4, 0.4, 0.4);

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const hasText = textFlags[i] ?? true;
    const isPartOpener = pageTexts[i] ? looksLikePartOpener(pageTexts[i]) : false;
    if (!hasText || i < 3 || isPartOpener) continue;

    const { width } = page.getSize();
    const textWidth = font.widthOfTextAtSize(line, size);
    const verso = (i + 1) % 2 === 0; // physical page parity: even = verso
    page.drawText(line, {
      x: verso ? 10 : width - textWidth - 10,
      y: 10,
      size,
      font,
      color: grey,
    });
  }

  return Buffer.from(await pdfDoc.save());
}
