// Server-side cover PDF fallback — used only when the client can't rasterize
// (no stored client render for ?export=pdf, or a plain-JSON save).
//
// It embeds the same bundled TTFs the interior uses, so non-Latin text
// (Devanagari, Tamil, Malayalam) renders instead of crashing on WinAnsi, and
// the output is much closer to the studio's SVG than the old standard-14
// Times approximation.

import { PDFDocument, rgb, degrees, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
// @pdf-lib/fontkit's shipped builds reference regeneratorRuntime — the polyfill
// must be imported before it is.
import "regenerator-runtime/runtime";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import path from "path";
import { resolveAppRoot } from "../app-root";
import {
  BLEED_IN,
  BARCODE_H_IN,
  BARCODE_INSET_IN,
  KDP_SPINE_TEXT_MIN_PAGES,
  formatTitleText,
  splitTitle,
  spineLabel,
  spineWidthInches,
  trimOf,
  validIsbn13,
  wrapText,
  type CoverDesignConfig,
  type CoverFont,
} from "./generator";

type Script = "latin" | "deva" | "tamil" | "mlym";

function scriptOf(cp: number): Script {
  if (cp >= 0x0900 && cp <= 0x097f) return "deva";
  if (cp >= 0x0b80 && cp <= 0x0bff) return "tamil";
  if (cp >= 0x0d00 && cp <= 0x0d7f) return "mlym";
  return "latin";
}

// Split text into runs of one script so each run can be drawn with the font
// that actually covers it.
function textRuns(text: string): { text: string; script: Script }[] {
  const runs: { text: string; script: Script }[] = [];
  for (const ch of text.normalize("NFC")) {
    const s = scriptOf(ch.codePointAt(0)!);
    const last = runs[runs.length - 1];
    if (last && last.script === s) last.text += ch;
    else runs.push({ text: ch, script: s });
  }
  return runs;
}

const FONT_FILES: Record<string, string> = {
  "EBGaramond-Regular": "EBGaramond/EBGaramond-Regular.ttf",
  "EBGaramond-Bold": "EBGaramond/EBGaramond-Bold.ttf",
  "NotoSerif-Regular": "NotoSerif/NotoSerif-Regular.ttf",
  "SourceSans3-Regular": "SourceSans3/SourceSans3-Regular.ttf",
  "SourceSans3-Bold": "SourceSans3/SourceSans3-Bold.ttf",
  "NotoSerifDevanagari-Regular": "NotoSerifDevanagari/NotoSerifDevanagari-Regular.ttf",
  "NotoSerifDevanagari-Bold": "NotoSerifDevanagari/NotoSerifDevanagari-Bold.ttf",
  "NotoSerifTamil-Regular": "NotoSerifTamil/NotoSerifTamil-Regular.ttf",
  "NotoSerifMalayalam-Regular": "NotoSerifMalayalam/NotoSerifMalayalam-Regular.ttf",
};

interface FallbackFonts {
  regular: PDFFont;
  bold: PDFFont;
  indic: Partial<Record<Script, PDFFont>>;
  /** False when the bundled TTFs could not be read and standard-14 fonts are in use. */
  realFonts: boolean;
}

const FONT_FAMILY_MAP: Record<CoverFont, { regular: string; bold: string }> = {
  cinzel: { regular: "EBGaramond-Regular", bold: "EBGaramond-Bold" },
  garamond: { regular: "EBGaramond-Regular", bold: "EBGaramond-Bold" },
  "noto-serif": { regular: "NotoSerif-Regular", bold: "EBGaramond-Bold" },
  poppins: { regular: "SourceSans3-Regular", bold: "SourceSans3-Bold" },
};

function fontBytes(name: string): Buffer | null {
  try {
    return fs.readFileSync(path.join(resolveAppRoot(), "src/lib/renderer/fonts", FONT_FILES[name]));
  } catch {
    return null;
  }
}

async function embedFallbackFonts(doc: PDFDocument, family: CoverFont): Promise<FallbackFonts> {
  doc.registerFontkit(fontkit);
  const wanted = FONT_FAMILY_MAP[family] || FONT_FAMILY_MAP.garamond;
  const regular = fontBytes(wanted.regular);
  const bold = fontBytes(wanted.bold);
  if (!regular || !bold) {
    // Missing font files — standard-14 fonts can only encode WinAnsi.
    return {
      regular: await doc.embedFont(StandardFonts.TimesRoman),
      bold: await doc.embedFont(StandardFonts.TimesRomanBold),
      indic: {},
      realFonts: false,
    };
  }
  const indic: FallbackFonts["indic"] = {};
  const indicFiles: [Script, string][] = [
    ["deva", "NotoSerifDevanagari-Regular"],
    ["tamil", "NotoSerifTamil-Regular"],
    ["mlym", "NotoSerifMalayalam-Regular"],
  ];
  for (const [script, name] of indicFiles) {
    const bytes = fontBytes(name);
    if (bytes) indic[script] = await doc.embedFont(bytes);
  }
  return {
    regular: await doc.embedFont(regular),
    bold: await doc.embedFont(bold),
    indic,
    realFonts: true,
  };
}

// Standard-14 fonts can only encode WinAnsi; strip anything else so a missing
// font file can never crash a save. Embedded TTFs accept full Unicode.
function sanitize(text: string, fonts: FallbackFonts): string {
  if (fonts.realFonts) return text;
  return text.replace(/[^\x00-\xFF]/g, "");
}

function runsWidth(text: string, size: number, fonts: FallbackFonts, bold: boolean): number {
  const latin = bold ? fonts.bold : fonts.regular;
  let w = 0;
  for (const run of textRuns(sanitize(text, fonts))) {
    const f = fonts.indic[run.script] || latin;
    w += f.widthOfTextAtSize(run.text, size);
  }
  return w;
}

// Draw text centred at cx, shrinking until it fits maxWidth (real metrics).
function drawCenteredFit(
  page: PDFPage,
  text: string,
  cx: number,
  y: number,
  baseSize: number,
  maxWidth: number,
  fonts: FallbackFonts,
  opts: { bold?: boolean; color: ReturnType<typeof rgb> }
) {
  const s = sanitize(text, fonts);
  if (!s.trim()) return;
  let size = baseSize;
  while (size > 6 && runsWidth(s, size, fonts, !!opts.bold) > maxWidth) size -= 0.5;
  drawRuns(page, s, cx - runsWidth(s, size, fonts, !!opts.bold) / 2, y, size, fonts, opts);
}

function drawRuns(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  fonts: FallbackFonts,
  opts: { bold?: boolean; color: ReturnType<typeof rgb>; rotate?: ReturnType<typeof degrees> }
) {
  const latin = opts.bold ? fonts.bold : fonts.regular;
  let cx = x;
  let cy = y;
  for (const run of textRuns(text)) {
    const f = fonts.indic[run.script] || latin;
    page.drawText(run.text, { x: cx, y: cy, size, font: f, color: opts.color, rotate: opts.rotate });
    // The advance must follow the rotation (with -90° the text runs
    // downward, so each run moves the anchor in -y, not +x).
    const adv = f.widthOfTextAtSize(run.text, size);
    if (opts.rotate) {
      const rad = ((opts.rotate as { angle: number }).angle * Math.PI) / 180;
      cx += adv * Math.cos(rad);
      cy += adv * Math.sin(rad);
    } else {
      cx += adv;
    }
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  if (clean.length === 3) {
    const r = ((num >> 8) & 15) * 17;
    const g = ((num >> 4) & 15) * 17;
    const b = (num & 15) * 17;
    return { r: r / 255, g: g / 255, b: b / 255 };
  }
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return { r: r / 255, g: g / 255, b: b / 255 };
}

export async function generateCoverPdf(config: CoverDesignConfig): Promise<Buffer> {
  const doc = await PDFDocument.create();

  // Print points: 1 inch = 72 points. Trim + 0.125″ bleed on the outer edges.
  const isPaperback = config.format === "paperback";
  const trim = trimOf(config);
  const spinePt = isPaperback ? spineWidthInches(config.pageCount || 100, config.paper) * 72 : 0;
  const panelPt = isPaperback ? (trim.w + BLEED_IN) * 72 : 6 * 72;
  const coverWidth = isPaperback ? panelPt * 2 + spinePt : panelPt;
  const coverHeight = isPaperback ? (trim.h + 2 * BLEED_IN) * 72 : 9.6 * 72;

  const page = doc.addPage([coverWidth, coverHeight]);

  const pColor = hexToRgb(config.palette.primary);
  const sColor = hexToRgb(config.palette.secondary);
  const aColor = hexToRgb(config.palette.accent);
  const tColor = hexToRgb(config.palette.textColor);
  const stColor = hexToRgb(config.palette.subtextColor);

  const fonts = await embedFallbackFonts(doc, config.typography.fontFamily);

  // Vertical gradient approximation (two stacked rects)
  page.drawRectangle({ x: 0, y: coverHeight / 2, width: coverWidth, height: coverHeight / 2, color: rgb(pColor.r, pColor.g, pColor.b) });
  page.drawRectangle({ x: 0, y: 0, width: coverWidth, height: coverHeight / 2, color: rgb(sColor.r, sColor.g, sColor.b) });

  const frontOriginX = isPaperback ? panelPt + spinePt : 0;
  const centerX = frontOriginX + panelPt / 2;

  page.drawRectangle({
    x: frontOriginX + 18,
    y: 18,
    width: panelPt - 36,
    height: coverHeight - 36,
    borderColor: rgb(aColor.r, aColor.g, aColor.b),
    borderWidth: 1.5,
  });

  const formattedTitle = formatTitleText(config.title, config.typography.titleCase);
  const titleLines = splitTitle(formattedTitle);
  let y = coverHeight - 160;
  for (const line of titleLines) {
    drawCenteredFit(page, line, centerX, y, 26, panelPt - 90, fonts, { bold: true, color: rgb(tColor.r, tColor.g, tColor.b) });
    y -= 34;
  }

  if (config.subtitle) {
    drawCenteredFit(page, config.subtitle, centerX, y - 6, 12, panelPt - 90, fonts, { color: rgb(stColor.r, stColor.g, stColor.b) });
  }

  if (config.tagline) {
    drawCenteredFit(page, config.tagline.toUpperCase(), centerX, coverHeight - 90, 8, panelPt - 90, fonts, { color: rgb(aColor.r, aColor.g, aColor.b) });
  }

  drawCenteredFit(page, config.author.toUpperCase(), centerX, 100, 16, panelPt - 60, fonts, { bold: true, color: rgb(tColor.r, tColor.g, tColor.b) });

  const pubText = (config.publisher || "").trim().toUpperCase();
  if (pubText) {
    drawCenteredFit(page, pubText, centerX, 50, 8, panelPt - 60, fonts, { color: rgb(aColor.r, aColor.g, aColor.b) });
  }

  if (isPaperback) {
    if ((config.pageCount || 100) >= KDP_SPINE_TEXT_MIN_PAGES) {
      const label = spineLabel(config);
      // Matches the browser export: rotated so the spine reads top → bottom.
      // pdf-lib rotate(-90) runs the text downward; rotate(90) reads upward.
      const available = coverHeight - 72; // 0.5″ headroom top and bottom
      let spineSize = Math.min(10, Math.max(6, (spinePt - 9) * 0.75));
      while (spineSize > 6 && runsWidth(label, spineSize, fonts, true) > available) spineSize -= 0.5;
      const textW = runsWidth(label, spineSize, fonts, true);
      if (textW <= available) {
        drawRuns(page, sanitize(label, fonts), panelPt + spinePt / 2 + spineSize * 0.35, (coverHeight + textW) / 2, spineSize, fonts, {
          bold: true,
          color: rgb(tColor.r, tColor.g, tColor.b),
          rotate: degrees(-90),
        });
      }
    }

    // Back cover: frame and the author's blurb. The bottom-right barcode
    // area stays empty for KDP; a valid ISBN is printed as text beside it.
    page.drawRectangle({ x: 18, y: 18, width: panelPt - 36, height: coverHeight - 36, borderColor: rgb(aColor.r, aColor.g, aColor.b), borderWidth: 1 });
    const blurb = (config.backBlurb || "").trim();
    if (blurb) {
      drawCenteredFit(page, "ABOUT THIS BOOK", panelPt / 2, coverHeight - 80, 12, panelPt - 40, fonts, { bold: true, color: rgb(aColor.r, aColor.g, aColor.b) });
      const barcodeTopPt = (BLEED_IN + BARCODE_INSET_IN + BARCODE_H_IN) * 72;
      const maxLines = Math.floor((coverHeight - 120 - barcodeTopPt - 15) / 15) + 1;
      let blurbY = coverHeight - 120;
      for (const line of wrapText(blurb, 85).slice(0, Math.min(20, maxLines))) {
        drawRuns(page, sanitize(line, fonts), 40, blurbY, 10.5, fonts, { color: rgb(tColor.r, tColor.g, tColor.b) });
        blurbY -= 15;
      }
    }
    const isbn = validIsbn13(config.isbn);
    if (isbn) {
      drawRuns(page, `ISBN ${isbn}`, 40, (BLEED_IN + BARCODE_INSET_IN) * 72, 8, fonts, { color: rgb(stColor.r, stColor.g, stColor.b) });
    }
  }

  // Uncompressed object streams: older preflight tools (and our own font
  // checks) read font descriptors straight from the file.
  const pdfBytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(pdfBytes);
}
