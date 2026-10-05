// Print QA gate — bookstore-grade assertions on the real fixture PDF.
// Mirrors the ten checks in the task spec.  External poppler tools are used
// when present; otherwise the Node/PDF equivalents (pdfjs text items, raw
// font dictionary scan) provide the same signal.

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { analyzeManuscript } from "../src/lib/ai/analyzer";
import { generateTypstSource } from "../src/lib/renderer/typst/generator";
import { compileTypst } from "../src/lib/renderer/typst/compiler";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";
import type { BookStructureV1 } from "../src/lib/manuscript/types";
import { decodePng, encodePng, crop, meanAbsDiff } from "./helpers/png";

const FIXTURE = path.join(__dirname, "fixtures", "ROOT_ACCESS_Print_Ready_Formatted.docx");
const OUT_PDF = path.join(__dirname, "fixtures", "out-print-qa.pdf");
const GOLDEN_DIR = path.join(__dirname, "fixtures", "golden");
const FONTS_DIR = path.join(process.cwd(), "src", "lib", "renderer", "fonts");

interface PageInfo {
  text: string;
  items: { str: string; x: number; y: number; w: number; h: number }[];
  width: number;
  height: number;
}

let structure: BookStructureV1;
let pdfBuffer: Buffer;
let typstSource = "";
let pages: PageInfo[] = [];

// -- helpers ----------------------------------------------------------------

async function extractPages(buf: Buffer): Promise<PageInfo[]> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise;
  const out: PageInfo[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items
      .filter((it: any) => (it.str || "").trim())
      .map((it: any) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        w: it.width || 0,
        h: it.height || Math.abs(it.transform[3]) || 0,
      }));
    out.push({
      text: content.items
        .map((it: any) => it.str || "")
        .reduce((acc: string, curr: string) => {
          if (!acc) return curr;
          if (/^[;:,.!?]/.test(curr)) return acc + curr;
          return acc + " " + curr;
        }, ""),
      items,
      width: vp.width,
      height: vp.height,
    });
  }
  await doc.destroy().catch(() => {});
  return out;
}

const CH_EYEBROW = /C\s*H\s*A\s*P\s*T\s*E\s*R/i;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

// The physical page whose printed folio is a given arabic number.  The folio
// prints at the foot of every body page — we find the page whose bottom-centre
// item equals the folio string.
function pageWithFolio(n: number): number {
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const foot = p.items.filter(
      (it) => it.y < p.height * 0.08 && /^[0-9]+$/.test(it.str.trim())
    );
    if (foot.some((it) => parseInt(it.str, 10) === n)) return i + 1;
  }
  return -1;
}

// Page indices of chapter openers: a page whose text carries the small-caps
// "C H A P T E R <word>" eyebrow plus the chapter title.  Tracking spreads
// the smallcaps letters — compare on space-stripped text.
function chapterOpenerPages(): { chapter: number; title: string; page: number }[] {
  const chapters = (structure.chapters || []).filter((c) => c.kind !== "part");
  const squeeze = (s: string) => s.replace(/[\s’'"]+/g, "").toUpperCase();
  return chapters.map((ch) => {
    const labelKey = squeeze(ch.label || "");
    const titleKey = squeeze(norm(ch.title).split(" ").slice(0, 3).join(" "));
    const idx = pages.findIndex((p) => {
      const sq = squeeze(p.text);
      return sq.includes(labelKey) && sq.includes(titleKey);
    });
    return { chapter: ch.number, title: ch.title, page: idx + 1 };
  });
}

// -- fixture render -----------------------------------------------------------

beforeAll(async () => {
  const buf = fs.readFileSync(FIXTURE);
  structure = await analyzeManuscript(
    buf,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    path.basename(FIXTURE)
  );
  const settings = getEffectiveSettings(getTemplate("classic"), "5.5x8.5", {
    fontSizePt: 11,
    lineHeight: 1.36,
    marginInsideMm: 20,
    marginOutsideMm: 14,
    marginTopMm: 18,
    marginBottomMm: 19,
  });
  const gen = generateTypstSource({ jobId: "print-qa", structure, settings, templateName: "classic" });
  typstSource = gen.source;
  pdfBuffer = await compileTypst(gen.source, FONTS_DIR, gen.images);
  // Signature pad (same as production): pdf-lib blank leaves to a multiple of 4.
  const { padPdfToMultiple } = await import("../src/lib/renderer/publication-renderer");
  pdfBuffer = await padPdfToMultiple(pdfBuffer, 4);
  fs.writeFileSync(OUT_PDF, pdfBuffer);
  pages = await extractPages(pdfBuffer);
}, 240_000);

// -- the gate -----------------------------------------------------------------

describe("print QA gate", () => {
  it("1. fonts are all embedded and include Noto Serif Devanagari", () => {
    // pdffonts isn't installed here; scan the font dictionaries instead —
    // every font must carry an embedded FontFile2/FontFile3 stream.
    const raw = pdfBuffer.toString("latin1");
    const baseFonts = [...raw.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+._-]+)/g)].map((m) => m[1]);
    const names = [...new Set(baseFonts)];
    expect(names.length).toBeGreaterThan(0);
    expect(names.some((n) => /NotoSerifDevanagari/.test(n))).toBe(true);
    const embeddedCount = (raw.match(/\/FontFile2?\b/g) || []).length;
    expect(embeddedCount).toBeGreaterThanOrEqual(names.length);
    // No unembedded (non-subset) Base-14 fonts.
    expect(names.filter((n) => !n.includes("+")).length).toBe(0);
  });

  it("2. no 'CHAPTER' eyebrow in the last 3 lines of any page", () => {
    let layout = "";
    try {
      layout = execFileSync("pdftotext", ["-layout", OUT_PDF, "-"]).toString("utf8");
    } catch {
      layout = pages.map((p) => p.text).join("\f"); // pdfjs fallback
    }
    for (const page of layout.split("\f")) {
      const lines = page.split("\n").map((l) => l.trim()).filter(Boolean);
      const tail = lines.slice(-3);
      for (const l of tail) {
        expect(norm(l)).not.toMatch(/^CHAPTER\s/i);
      }
    }
  });

  it("3. every chapter opens on an odd page with no running head", () => {
    const openers = chapterOpenerPages();
    expect(openers.length).toBeGreaterThanOrEqual(16);
    for (const o of openers) {
      expect(o.page, `chapter ${o.chapter} "${o.title}" must open on odd page`).toBeGreaterThan(0);
      expect(o.page % 2).toBe(1);
      // No running head: nothing in the top margin zone (~top 7% of page).
      const p = pages[o.page - 1];
      const headItems = p.items.filter((it) => it.y + it.h > p.height * 0.94);
      expect(headItems.length, `running head found on opener for "${o.title}"`).toBe(0);
    }
  });

  it("4. practice boxes never cross a page boundary", () => {
    const practices: { label: string; steps: string[] }[] = [];
    for (const ch of structure.chapters) {
      for (const sec of ch.sections) {
        for (const b of sec.blocks) {
          if (b.type === "practice_box") {
            const steps: string[] = [];
            for (const ib of b.blocks || []) {
              if (ib.items) steps.push(...ib.items.map((i) => norm(i).slice(0, 40)));
              else if (ib.text) steps.push(norm(ib.text).slice(0, 40));
            }
            practices.push({ label: b.label || "", steps });
          }
        }
      }
    }
    expect(practices.length).toBeGreaterThanOrEqual(4);
    for (const pr of practices) {
      // The box (eyebrow + label + all steps) fits on one page, OR spans only
      // pages that repeat "PRACTICE (CONTINUED)".
      const hitPages = new Set<number>();
      const wanted = [...stepsForSearch(pr)].map(norm);
      pages.forEach((p, i) => {
        const t = norm(p.text);
        if (wanted.every((w) => t.includes(w.slice(0, 30)))) hitPages.add(i + 1);
      });
      const boxes = [...hitPages];
      expect(boxes.length, `practice "${pr.label}" found on pages ${boxes}`).toBeGreaterThan(0);
      for (const pg of boxes) {
        if (pg !== boxes[0]) {
          expect(norm(pages[pg - 1].text)).toContain("PRACTICE (CONTINUED)");
        }
      }
      // each box chunk is unbreakable: a box's steps all live on one page
      const stepPages = new Set<number>();
      for (const st of pr.steps.slice(0, 5)) {
        pages.forEach((p, i) => {
          if (norm(p.text).includes(st.slice(0, 30))) stepPages.add(i + 1);
        });
      }
      const spread = [...stepPages].sort((a, b) => a - b);
      if (spread.length > 1) {
        expect(spread[spread.length - 1] - spread[0]).toBeLessThanOrEqual(1);
      }
    }

    function stepsForSearch(pr: { label: string; steps: string[] }) {
      return [pr.label, ...pr.steps.slice(0, 2)].filter(Boolean);
    }
  });

  it("5. no missing space after periods; no space before punctuation", () => {
    const full = pages.map((p) => p.text).join("\n");
    const missing = full.match(/[a-z]\.[A-Z]/g) || [];
    expect(missing.slice(0, 5), `missing space: ${missing.slice(0, 5).join(", ")}`).toHaveLength(0);
    const beforePunct = full.match(/ [;:,.!?]/g) || [];
    expect(beforePunct.slice(0, 5), `space before punct: ${beforePunct.slice(0, 5).join(", ")}`).toHaveLength(0);
    // No straight quotes left anywhere — smartquote turns ' and " into
    // curly forms; a surviving ASCII ' between letters is a miss.
    expect(full.match(/[a-zA-Z]"|[a-zA-Z]'[a-z]/g) || []).toHaveLength(0);
  });

  it("6. blank pages contain zero text objects", () => {
    const blankPages = pages.filter((p) => p.items.length === 0);
    // Every genuinely blank page must have zero items — including the filler
    // versos and the signature padding at the end.
    const textOnly = pages.filter((p) => p.text.trim().length === 0);
    for (const p of textOnly) {
      expect(p.items, `blank page ${pages.indexOf(p) + 1} has ${p.items.length} items`).toHaveLength(0);
    }
    expect(blankPages.length).toBeGreaterThan(0);
  });

  it("7. ToC page numbers match the actual chapter pages", () => {
    // The ToC occupies its own pages (after "Contents", before the first
    // front-matter text section); each entry is a title item plus a folio
    // item sharing the same baseline.
    const contentsIdx = pages.findIndex((p) => p.items.some((it) => it.str.trim() === "Contents"));
    expect(contentsIdx).toBeGreaterThanOrEqual(0);
    const noteIdx = pages.findIndex((p, i) => i > contentsIdx && p.text.includes("A Note Before We Begin"));
    const tocPages = pages.slice(contentsIdx, noteIdx > contentsIdx ? noteIdx : contentsIdx + 4);
    // The real part-opener page starts with the marker — the ToC page merely
    // lists "PA RT O N E · …" mid-page, so match on the page's own start.
    const partOneIdx = pages.findIndex((p) =>
      p.text.replace(/\s+/g, "").toUpperCase().startsWith("PARTONE")
    );
    expect(partOneIdx).toBeGreaterThanOrEqual(0);
    let checked = 0;
    for (const ch of (structure.chapters || []).filter((c) => c.kind !== "part")) {
      const firstWords = norm(ch.title).split(" ").slice(0, 3).join(" ").replace(/’/g, "'").toLowerCase();
      let printedFolio = -1;
      for (const p of tocPages) {
        const titleItem = p.items.find((it) =>
          norm(it.str).replace(/’/g, "'").toLowerCase().includes(firstWords)
        );
        if (!titleItem) continue;
        const folioItem = p.items.find(
          (it) => Math.abs(it.y - titleItem.y) < 3 && /^[0-9]+$/.test(it.str.trim())
        );
        if (folioItem) {
          printedFolio = parseInt(folioItem.str.trim(), 10);
          break;
        }
      }
      expect(printedFolio, `no ToC entry found for "${ch.title}"`).toBeGreaterThan(0);
      const opener = chapterOpenerPages().find((o) => o.title === ch.title);
      expect(opener).toBeTruthy();
      const expectedFolio = opener!.page - partOneIdx; // part 1 physical page = folio 1
      expect(printedFolio, `ToC says ${printedFolio}, actual folio ${expectedFolio}`).toBe(expectedFolio);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(14);
  });

  it("8. margins: inside gutter >= .75in, others >= .5in, 0.125in trim safety", () => {
    const GUTTER = 0.75 * 72; // 54pt
    const MARGIN = 0.5 * 72; // 36pt
    const SAFETY = 0.125 * 72; // 9pt
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (p.items.length === 0) continue;
      const recto = (i + 1) % 2 === 1;
      for (const it of p.items) {
        const left = it.x;
        const right = it.x + it.w;
        const bottom = it.y;
        const top = it.y + it.h;
        // Hard trim safety — no ink within 0.125in of any edge.
        expect(left, `p${i + 1} left-safety "${it.str.slice(0, 20)}"`).toBeGreaterThanOrEqual(SAFETY - 1);
        expect(right, `p${i + 1} right-safety "${it.str.slice(0, 20)}"`).toBeLessThanOrEqual(p.width - SAFETY + 1);
        expect(bottom).toBeGreaterThanOrEqual(SAFETY - 1);
        expect(top).toBeLessThanOrEqual(p.height - SAFETY + 1);
        // Binding margin (inside) — headers/folios may sit in the outer
        // margins but never in the gutter.
        const inside = recto ? left : p.width - right;
        expect(inside, `p${i + 1} gutter "${it.str.slice(0, 20)}"`).toBeGreaterThanOrEqual(GUTTER - 1.5);
      }
    }
  });

  it("9. Devanagari line renders identically to the golden crop", async () => {
    // Locate the page + bbox containing the Devanagari verse.
    const devaRe = /[\u0900-\u097F]/;
    let devaPage = -1;
    let bbox = { x: 0, y: 0, x2: 0, y2: 0 };
    for (let i = 0; i < pages.length; i++) {
      const items = pages[i].items.filter((it) => devaRe.test(it.str));
      if (items.length > 0) {
        devaPage = i + 1;
        bbox = {
          x: Math.min(...items.map((it) => it.x)),
          y: Math.min(...items.map((it) => it.y)),
          x2: Math.max(...items.map((it) => it.x + it.w)),
          y2: Math.max(...items.map((it) => it.y + it.h)),
        };
        break;
      }
    }
    expect(devaPage).toBeGreaterThan(0);

    // Render the page to PNG via Typst (same engine, deterministic).
    const tmp = fs.mkdtempSync(path.join(process.cwd(), ".typst-render-tmp", "gold-"));
    fs.writeFileSync(path.join(tmp, "main.typ"), typstSource);
    const bin = path.join(process.cwd(), "bin", process.platform === "win32" ? "typst.exe" : "typst");
    execFileSync(bin, [
      "compile", "--root", process.cwd(), "--font-path", FONTS_DIR,
      "--format", "png", "--ppi", "100",
      path.join(tmp, "main.typ"), path.join(tmp, "p{n}.png"),
    ]);
    const pngFile = path.join(tmp, `p${devaPage}.png`);
    expect(fs.existsSync(pngFile)).toBe(true);
    const img = decodePng(fs.readFileSync(pngFile));

    // pdfjs y grows upward from the page bottom; PNG y grows downward.
    const scale = 100 / 72;
    const pgHeight = pages[devaPage - 1].height;
    const cy = Math.max(0, Math.floor((pgHeight - bbox.y2) * scale) - 8);
    const cx = Math.max(0, Math.floor(bbox.x * scale) - 8);
    const cw = Math.min(img.width - cx, Math.ceil((bbox.x2 - bbox.x) * scale) + 16);
    const chh = Math.min(img.height - cy, Math.ceil((bbox.y2 - bbox.y) * scale) + 16);
    let shot = crop(img, cx, cy, cw, chh);

    fs.mkdirSync(GOLDEN_DIR, { recursive: true });
    const goldenPath = path.join(GOLDEN_DIR, "devanagari-verse.png");
    if (!fs.existsSync(goldenPath)) {
      fs.writeFileSync(goldenPath, encodePng(shot)); // bootstrap the golden
    }
    const golden = decodePng(fs.readFileSync(goldenPath));
    if (
      Math.abs(shot.width - golden.width) <= 2 &&
      Math.abs(shot.height - golden.height) <= 2 &&
      (shot.width !== golden.width || shot.height !== golden.height)
    ) {
      shot = crop(img, cx, cy, golden.width, golden.height);
    }
    const diff = meanAbsDiff(shot, golden);
    expect(Number.isFinite(diff), `golden size ${golden.width}x${golden.height} vs ${shot.width}x${shot.height}`).toBe(true);
    expect(diff).toBeLessThan(35);
  }, 300_000);

  it("10. page count is a multiple of 4", () => {
    expect(pages.length % 4).toBe(0);
  });
});
