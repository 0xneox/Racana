import { beforeAll, describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { analyzeManuscript } from "../src/lib/ai/analyzer";
import { generateTypstSource } from "../src/lib/renderer/typst/generator";
import { compileTypst } from "../src/lib/renderer/typst/compiler";
import { padPdfToMultiple } from "../src/lib/renderer/publication-renderer";
import { runPdfQa, kdpMinGutterMm } from "../src/lib/renderer/qa";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";
import type { BookStructureV1 } from "../src/lib/manuscript/types";

const FONTS = path.join(process.cwd(), "src", "lib", "renderer", "fonts");
const FIXTURE = path.join(__dirname, "fixtures", "ROOT_ACCESS_Print_Ready_Formatted.docx");

interface PageInfo { folio: string; head: string; body: string }

// Splits each page's text into running head / body / folio bands.
async function pageBands(pdf: Buffer): Promise<PageInfo[]> {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  const out: PageInfo[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const h = page.getViewport({ scale: 1 }).height;
    const items = (await page.getTextContent()).items as { str: string; transform: number[] }[];
    const band = (lo: number, hi: number) =>
      items.filter((it) => it.transform[5] >= lo && it.transform[5] < hi).map((it) => it.str).join(" ").replace(/\s+/g, " ").trim();
    // Folio sits in the bottom margin (< 40pt), running head in the top one.
    out.push({ folio: band(0, 40), head: band(h - 45, h), body: band(40, h - 45) });
  }
  await doc.destroy();
  return out;
}

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];

describe("ROOT_ACCESS classic render", () => {
  let structure: BookStructureV1;
  let source: string;
  let pdf: Buffer;
  let pages: PageInfo[];

  beforeAll(async () => {
    structure = await analyzeManuscript(fs.readFileSync(FIXTURE), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "root.docx");
    const settings = getEffectiveSettings(getTemplate("classic"), "6x9", {});
    const gen = generateTypstSource({ jobId: "t", structure, settings, templateName: "classic" });
    source = gen.source;
    pdf = await padPdfToMultiple(await compileTypst(source, FONTS, gen.images), 4);
    pages = await pageBands(pdf);
  }, 180_000);

  it("front-matter roman folios start at i on the contents page and only increase", () => {
    const romans = pages.map((p) => p.folio).filter((f) => ROMAN.includes(f));
    expect(romans[0]).toBe("i");
    const idx = romans.map((r) => ROMAN.indexOf(r));
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThan(idx[i - 1]);
    const contents = pages.find((p) => p.body.startsWith("Contents"));
    expect(contents?.folio).toBe("i");
  });

  it("no blank page carries a running head or folio", () => {
    const offenders = pages
      .map((p, i) => ({ ...p, n: i + 1 }))
      .filter((p) => p.body === "" && (p.head !== "" || p.folio !== ""));
    expect(offenders.map((p) => `p${p.n} head="${p.head}" folio="${p.folio}"`)).toEqual([]);
  });

  it("body pages still carry running heads", () => {
    expect(pages.filter((p) => p.head === "ROOT ACCESS").length).toBeGreaterThan(10);
  });

  it("chapter lead-ins use synthesized small caps, never the no-op smallcaps()", () => {
    expect(source).not.toContain("#smallcaps[");
    // Full-height initial, reduced-size capitals for the lowercase run.
    expect(source).toMatch(/#text\(tracking: 0\.05em\)\[O#text\(size: 0\.8em\)\[#upper\[ne\]\];/);
  });

  it("passes the strengthened print QA", async () => {
    const settings = getEffectiveSettings(getTemplate("classic"), "6x9", {});
    const qa = await runPdfQa(pdf, { jobId: "t", structure, settings, templateName: "classic" });
    expect(qa.passed).toBe(true);
    const codes = qa.issues.map((i) => i.code);
    expect(codes).toContain("MARGINS_VERIFIED");
    expect(codes).toContain("FONTS_EMBEDDED");
  });
});

describe("print QA rejects what KDP rejects", () => {
  const settings = getEffectiveSettings(getTemplate("classic"), "6x9", {});
  const structure = { chapters: [] } as unknown as BookStructureV1;

  async function pdfWith(pages: number, embedFont = false): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const font = embedFont ? await doc.embedFont(StandardFonts.Helvetica) : null;
    for (let i = 0; i < pages; i++) {
      const p = doc.addPage([432, 648]);
      if (font) p.drawText("Lorem ipsum dolor sit amet ".repeat(4), { x: 40, y: 300, size: 9, font });
    }
    return Buffer.from(await doc.save({ useObjectStreams: false }));
  }

  it("pads short books up to the 24-page minimum", async () => {
    const padded = await padPdfToMultiple(await pdfWith(9), 4);
    expect((await PDFDocument.load(padded)).getPageCount()).toBe(24);
    const unpadded = await runPdfQa(await pdfWith(16, true), { jobId: "q", structure, settings, templateName: "classic" });
    expect(unpadded.issues.map((i) => i.code)).toContain("PAGE_COUNT_BELOW_MIN");
  });

  it("fails an unembedded (standard 14) font", async () => {
    const qa = await runPdfQa(await pdfWith(24, true), { jobId: "q", structure, settings, templateName: "classic" });
    expect(qa.passed).toBe(false);
    expect(qa.issues.find((i) => i.code === "FONT_NOT_EMBEDDED")?.description).toContain("Helvetica");
  });

  it("fails a gutter below the page-count minimum", async () => {
    expect(kdpMinGutterMm(120)).toBeCloseTo(9.525, 2);
    expect(kdpMinGutterMm(400)).toBeCloseTo(15.875, 2);
    const narrow = { ...settings, margins: { ...settings.margins, insideMm: 12 } };
    const pdf = await pdfWith(24);
    // 12mm passes at 24 pages but fails once the same book runs to 400.
    expect((await runPdfQa(pdf, { jobId: "q", structure, settings: narrow, templateName: "classic" })).issues.map((i) => i.code)).not.toContain("GUTTER_TOO_NARROW");
    const longPdf = await pdfWith(400);
    expect((await runPdfQa(longPdf, { jobId: "q", structure, settings: narrow, templateName: "classic" })).issues.map((i) => i.code)).toContain("GUTTER_TOO_NARROW");
  });
});
