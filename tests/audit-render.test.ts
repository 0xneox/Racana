import { it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { generateTypstSource } from "../src/lib/renderer/typst/generator";
import { compileTypst, compileTypstPng } from "../src/lib/renderer/typst/compiler";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";
import { analyzeManuscript } from "../src/lib/ai/analyzer";
import { resolveAppRoot } from "../src/lib/app-root";
import { resolvePdfWorker } from "../src/lib/pdf-worker";
import { extractTextWithPdfjs } from "../src/lib/manuscript/pdf-parser";
import { runPdfQa } from "../src/lib/renderer/qa";

const OUT = path.join(process.cwd(), ".audit-out");
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const KEYS = (process.env.AUDIT_KEYS || "classic,modern").split(",");
const FIXTURES = (process.env.AUDIT_FIXTURES || "novel_chapters.docx,philosophy_meditations.docx").split(",");

// Median distance between baselines on text-heavy pages — the ground truth
// for leading. The old engine passed the line-height multiple straight into
// par(leading:) and produced a ~26pt pitch on 11pt body (visually
// double-spaced); correct output is leadingEm × fontSizePt (±10%).
async function medianLinePitch(pdf: Buffer): Promise<number> {
  const pdfjs: any = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const workerPath = resolvePdfWorker();
  if (workerPath && pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = workerPath;
  const pdfjsDir = path.join(resolveAppRoot(), "node_modules", "pdfjs-dist");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: false,
    isEvalSupported: false,
    cMapUrl: pathToFileURL(path.join(pdfjsDir, "cmaps")).href + "/",
    cMapPacked: true,
    standardFontDataUrl: pathToFileURL(path.join(pdfjsDir, "standard_fonts")).href + "/",
  }).promise;
  const gaps: number[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const ys: number[] = [
        ...new Set<number>(
          content.items
            .filter((it: any) => it && typeof it.str === "string" && it.str.trim())
            .map((it: any) => Math.round(it.transform[5] * 10) / 10)
        ),
      ].sort((a, b) => b - a);
      if (ys.length < 10) continue; // skip front matter / openers / sparse pages
      for (let j = 0; j + 1 < ys.length; j++) {
        const d = ys[j] - ys[j + 1];
        if (d > 5 && d < 40) gaps.push(d);
      }
      page.cleanup?.();
    }
  } finally {
    await doc.destroy?.().catch(() => {});
  }
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] || 0;
}

it("audit render", async () => {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (f.endsWith(".png") || f.endsWith(".pdf")) fs.rmSync(path.join(OUT, f));
  const fontsDir = path.join(resolveAppRoot(), "src", "lib", "renderer", "fonts");

  for (const fixture of FIXTURES) {
    const buf = fs.readFileSync(path.join("tests/fixtures", fixture));
    const structure = await analyzeManuscript(buf, DOCX, fixture);
    fs.writeFileSync(path.join(OUT, `${fixture}.structure.json`), JSON.stringify(structure, null, 2));

    // --- Structure-level guarantees -------------------------------------
    expect(structure.author ?? "").not.toMatch(/unknown/i);
    if (fixture.startsWith("novel")) {
      // No title page in this docx — fall back to the filename, never an
      // interior heading.
      expect(structure.title).toBe("Novel Chapters");
      expect(structure.author ?? "").toBe("");
    }
    if (fixture.startsWith("philosophy")) {
      expect(structure.title).toBe("Meditations");
    }

    for (const key of KEYS) {
      const settings = getEffectiveSettings(getTemplate(key), "trim_6x9", {});
      const { source, images } = generateTypstSource({ jobId: `audit-${key}`, structure: structure as any, settings, templateName: key });
      const base = `${fixture.replace(".docx", "")}-${key}`;
      fs.writeFileSync(path.join(OUT, `${base}.typ`), source);

      // --- Source-level guarantees --------------------------------------
      expect(source).not.toContain('author: "Unknown"');
      expect(source).toContain(`#import "/src/lib/renderer/typst/templates/${key}.typ"`);
      if ((structure.chapters || []).length >= 2) {
        expect(source).toContain("#book-toc(");
      }
      if (key === "modern") {
        expect(source).toContain('chapterStyle: "modern"');
        expect(source).toContain('pageNumbers: "outer_header"');
        expect(source).toContain('"Source Serif 4"');
        expect(source).toContain('"Source Sans 3"');
        expect(source).toContain("firstLineIndentMm: 0");
      }
      if (key === "classic") {
        expect(source).toContain('chapterStyle: "classic"');
        expect(source).toContain('pageNumbers: "bottom_center"');
        expect(source).toContain('"EB Garamond"');
      }

      const pdf = await compileTypst(source, fontsDir, images);
      fs.writeFileSync(path.join(OUT, `${base}.pdf`), pdf);
      const pngs = await compileTypstPng(source, fontsDir, images, 40);
      pngs.forEach((p, i) => fs.writeFileSync(path.join(OUT, `${base}-p${String(i + 1).padStart(2, "0")}.png`), p));
      console.log(base, "pages:", pngs.length);

      // --- PDF-level guarantees -----------------------------------------
      const qa = await runPdfQa(pdf, { jobId: `audit-${key}`, structure: structure as any, settings, templateName: key });
      expect(qa.passed, `${base} QA: ${qa.issues.filter((i) => i.level === "error").map((i) => i.code).join(", ")}`).toBe(true);

      const { text } = await extractTextWithPdfjs(pdf);
      const pages = text.split("\f");

      // The placeholder byline must never reach the page.
      expect(text).not.toMatch(/\bUnknown\b/);
      // Generated front matter: half-title on p1, a copyright page, and a
      // table of contents when the book has chapters.
      expect(pages[0]).toContain(structure.title || "");
      expect(text).toContain("Copyright ©");
      if ((structure.chapters || []).length >= 2) {
        expect(text).toContain("Contents");
      }
      // Leading must equal leadingEm × bodySize — not double-spaced.
      const pitch = await medianLinePitch(pdf);
      const expected = settings.body.fontSizePt * settings.body.leadingEm;
      expect(
        Math.abs(pitch - expected) / expected,
        `${base} line pitch ${pitch.toFixed(1)}pt vs expected ${expected.toFixed(1)}pt`
      ).toBeLessThan(0.1);
    }
  }

  // --- Templates must produce meaningfully different source --------------
  const classicSrc = fs.readFileSync(path.join(OUT, `${FIXTURES[0].replace(".docx", "")}-classic.typ`), "utf8");
  const modernSrc = fs.readFileSync(path.join(OUT, `${FIXTURES[0].replace(".docx", "")}-modern.typ`), "utf8");
  expect(classicSrc).not.toBe(modernSrc);
}, 600000);
