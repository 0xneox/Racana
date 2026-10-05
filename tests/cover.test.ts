import { describe, it, expect } from "vitest";
import { generateCoverSvg, generateCoverPdf, COVER_PRESETS, spineWidthPx } from "../src/lib/cover/generator";

describe("Cover Page Studio Generator", () => {
  it("provides rich curated presets with Indian & classical aesthetics", () => {
    expect(COVER_PRESETS.length).toBeGreaterThanOrEqual(4);
    const saffron = COVER_PRESETS.find((p) => p.id === "royal-saffron");
    expect(saffron).toBeDefined();
    expect(saffron?.ornament).toBe("mandala");
    expect(saffron?.palette.accent).toBe("#E5B138");
  });

  it("generates clean SVG for single front ebook cover", () => {
    const svg = generateCoverSvg({
      title: "Gitanjali Revisited",
      subtitle: "Songs of the Spirit",
      author: "Rabindranath Tagore",
      tagline: "Nobel Centennial Edition",
      palette: COVER_PRESETS[0].palette,
      typography: COVER_PRESETS[0].typography,
      ornament: "mandala",
      layoutStyle: "heritage",
      format: "ebook",
    });

    expect(svg).toContain("<svg");
    expect(svg).toContain("GITANJALI REVISITED");
    expect(svg).toContain("Songs of the Spirit");
    expect(svg).toContain("RABINDRANATH TAGORE");
    expect(svg).toContain("NOBEL CENTENNIAL EDITION");
    expect(svg).toContain("mandala");
  });

  it("generates clean SVG for full-wrap paperback cover (front, spine, back)", () => {
    const svg = generateCoverSvg({
      title: "The Art of Living",
      subtitle: "Ancient Wisdom for Modern Times",
      author: "Swami Vivekananda",
      backBlurb: "A classic guide to spiritual strength and fearlessness.",
      palette: COVER_PRESETS[1].palette,
      typography: COVER_PRESETS[1].typography,
      ornament: "lotus",
      layoutStyle: "centered",
      format: "paperback",
      pageCount: 220,
    });

    expect(svg).toContain("<svg");
    // Full-wrap width = 2 panels (2×800) + spine for 220pp cream paper;
    // height is 6×9 trim + bleed (9.25″) at the panel's px-per-inch.
    const expectedW = 1600 + spineWidthPx(220);
    expect(svg).toContain(`viewBox="0 0 ${expectedW} ${Math.round(9.25 * (800 / 6.125))}"`);
    expect(svg).toContain("PRAISE &amp; OVERVIEW");
    expect(svg).toContain("A classic guide to spiritual strength and fearlessness.");
    expect(svg).toContain("THE ART OF LIVING");
  });

  it("generates print-ready PDF using pdf-lib", async () => {
    const pdfBuf = await generateCoverPdf({
      title: "The Indian Epic",
      author: "Vyasa",
      palette: COVER_PRESETS[0].palette,
      typography: COVER_PRESETS[0].typography,
      ornament: "mandala",
      layoutStyle: "heritage",
      format: "ebook",
    });

    expect(pdfBuf).toBeDefined();
    expect(pdfBuf.length).toBeGreaterThan(1000);
    // PDF header magic bytes
    expect(pdfBuf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("generates full-wrap paperback PDF with spine and barcode", async () => {
    const pdfBuf = await generateCoverPdf({
      title: "The Indian Epic",
      author: "Vyasa",
      palette: COVER_PRESETS[0].palette,
      typography: COVER_PRESETS[0].typography,
      ornament: "mandala",
      layoutStyle: "heritage",
      format: "paperback",
      pageCount: 300,
    });

    expect(pdfBuf).toBeDefined();
    expect(pdfBuf.length).toBeGreaterThan(1000);
    expect(pdfBuf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
