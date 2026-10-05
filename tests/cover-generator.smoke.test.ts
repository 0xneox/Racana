import { describe, it, expect } from "vitest";
import {
  generateCoverSvg,
  generateCoverPdf,
  spineWidthInches,
  coverPhysicalSize,
  wrapText,
  COVER_PRESETS,
  type CoverDesignConfig,
} from "../src/lib/cover/generator";

const base: CoverDesignConfig = {
  title: "The Very Long Title of an Indian Literary Novel About Rivers and Time",
  subtitle: "A journey through memory",
  author: "Aryavrat Varma",
  tagline: "National Bestseller",
  format: "ebook",
  pageCount: 180,
  palette: COVER_PRESETS[0].palette,
  typography: COVER_PRESETS[0].typography,
  ornament: "mandala",
  layoutStyle: "centered",
  spineText: "Rivers and Time",
  backBlurb: "A luminous tale woven with depth. ".repeat(20),
  aboutAuthor: "Aryavrat Varma is a novelist and historian.",
  isbn: "978-93-89000-01-2",
  publisher: "Racana Books",
};

describe("cover generator", () => {
  for (const layout of ["centered", "editorial", "heritage", "minimal"] as const) {
    for (const format of ["ebook", "paperback"] as const) {
      it(`renders ${layout}/${format}`, () => {
        const svg = generateCoverSvg({ ...base, layoutStyle: layout, format }, { showGuides: true });
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg.endsWith("</svg>")).toBe(true);
        expect(svg).toContain("ARYAVRAT VARMA".slice(0, 8));
        if (format === "paperback") expect(svg).toContain("SPINE");
        if (format === "paperback") expect(svg).toContain("ISBN 978-93-89000-01-2");
      });
    }
  }

  it("computes KDP cream-paper spine width", () => {
    expect(spineWidthInches(180)).toBeCloseTo(0.45, 3);
    expect(spineWidthInches(10)).toBeCloseTo(24 * 0.0025, 4); // KDP 24-page minimum
    expect(spineWidthInches(180, "white")).toBeCloseTo(180 * 0.002252, 4);
  });

  it("sizes paperback wrap = 2 panels + spine", () => {
    const s = coverPhysicalSize({ ...base, format: "paperback", pageCount: 180 });
    expect(s.wIn).toBeCloseTo(12.25 + 0.45, 3);
    expect(s.hIn).toBeCloseTo(9.25, 3); // 9″ trim + 0.125″ bleed top and bottom
  });

  it("wraps text without breaking words", () => {
    const lines = wrapText("the quick brown fox jumps over the lazy dog", 20);
    expect(lines.every((l) => l.length <= 20)).toBe(true);
    expect(lines.join(" ")).toBe("the quick brown fox jumps over the lazy dog");
  });

  it("escapes XML in titles", () => {
    const svg = generateCoverSvg({ ...base, title: 'A&B <Test> "Q"' });
    expect(svg).toContain("A&amp;B");
    expect(svg).not.toContain("<Test>");
  });

  it("generates a fallback PDF buffer", async () => {
    const buf = await generateCoverPdf({ ...base, format: "paperback", pageCount: 180 });
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
