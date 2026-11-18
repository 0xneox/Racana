import { describe, it, expect } from "vitest";
import {
  COVER_PRESETS,
  coverContentWarnings,
  coverGeometry,
  coverPhysicalSize,
  fitSingleLine,
  generateCoverSvg,
  spineLabel,
  type CoverDesignConfig,
} from "../src/lib/cover/generator";
import { generateCoverPdf } from "../src/lib/cover/pdf-fallback";
import { PDFDocument } from "pdf-lib";

const base: CoverDesignConfig = {
  title: "Rivers of Time",
  author: "Aryavrat Varma",
  palette: COVER_PRESETS[0].palette,
  typography: { fontFamily: "garamond", titleCase: "uppercase" },
  ornament: "mandala",
  layoutStyle: "centered",
  format: "paperback",
  pageCount: 220,
  trimSize: "6x9",
  paper: "cream",
};

describe("cover text fitting (#11)", () => {
  const LONG_AUTHOR =
    "Dr. Saraswati Rajalakshmi Venkatanarayanan Iyer-Bhattacharya";

  for (const layout of ["centered", "minimal", "heritage"] as const) {
    it(`shrinks a very long author name in ${layout}`, () => {
      const long = generateCoverSvg({ ...base, layoutStyle: layout, author: LONG_AUTHOR });
      // The author <text> element's size must drop below the layout's base size.
      const authorTag = long.split("\n").find((l) => l.includes(LONG_AUTHOR.toUpperCase()) && l.includes("font-size"));
      const m = authorTag?.match(/font-size="([\d.]+)"/);
      expect(m, `${layout} author element not found`).toBeTruthy();
      expect(Number(m![1])).toBeLessThan(layout === "centered" ? 28 : 20);
    });
  }

  it("drops spine text that can never fit instead of printing off the cover", () => {
    const svg = generateCoverSvg({
      ...base,
      spineText: "An Extraordinarily Long Spine Title That Cannot Possibly Fit On Any Reasonable Spine Width Even At The Smallest Legible Size".repeat(3),
      pageCount: 120,
    });
    expect(coverContentWarnings({
      ...base,
      spineText: "An Extraordinarily Long Spine Title That Cannot Possibly Fit On Any Reasonable Spine Width Even At The Smallest Legible Size".repeat(3),
      pageCount: 120,
    }).map((w) => w.code)).toContain("SPINE_TEXT_TOO_LONG");
    // The rotated spine <text> must not be emitted.
    expect(svg.includes("rotate(90)")).toBe(false);
  });
});

describe("truncation warnings (#12)", () => {
  it("warns when the blurb exceeds what fits", () => {
    const w = coverContentWarnings({ ...base, backBlurb: "A very long blurb indeed. ".repeat(120) });
    expect(w.map((x) => x.code)).toContain("BLURB_TRUNCATED");
    const ok = coverContentWarnings({ ...base, backBlurb: "A short blurb." });
    expect(ok.map((x) => x.code)).not.toContain("BLURB_TRUNCATED");
  });

  it("warns when the author bio can't fit above the barcode area", () => {
    const w = coverContentWarnings({
      ...base,
      backBlurb: "Filling the blurb space. ".repeat(80),
      aboutAuthor: "A long and storied career. ".repeat(120),
    });
    expect(w.map((x) => x.code)).toContain("BIO_TRUNCATED");
  });
});

describe("server-side fallback (#13)", () => {
  it("renders Devanagari text instead of crashing on WinAnsi", async () => {
    const pdf = await generateCoverPdf({
      ...base,
      title: "मेरा सफ़र",
      author: "अरविंद शर्मा",
      typography: { fontFamily: "noto-serif", titleCase: "uppercase" },
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const doc = await PDFDocument.load(pdf);
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    const expected = coverPhysicalSize({ ...base, format: "paperback" });
    expect(Math.abs(width - expected.wIn * 72)).toBeLessThan(2);
    expect(Math.abs(height - expected.hIn * 72)).toBeLessThan(2);
  });

  it("embeds the bundled fonts, not the standard-14 Times", async () => {
    const pdf = await generateCoverPdf({ ...base });
    // Embedded font files appear in the raw PDF — standard-14 fonts never embed.
    const raw = pdf.toString("latin1");
    expect(raw).toMatch(/FontFile2|FontFile3/);
    expect(raw).not.toContain("Times-Roman");
  });
});

describe("watermarked free exports (#18)", () => {
  it("adds the preview watermark only when asked", () => {
    expect(generateCoverSvg(base, { watermark: true })).toContain('data-watermark="1"');
    expect(generateCoverSvg(base)).not.toContain('data-watermark="1"');
    expect(generateCoverSvg({ ...base, format: "ebook" }, { watermark: true })).toContain('data-watermark="1"');
  });
});
