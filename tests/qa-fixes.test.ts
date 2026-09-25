import { it, expect, describe } from "vitest";
import fs from "fs";
import { parsePdf } from "../src/lib/manuscript/pdf-parser";
import { analyzeManuscript } from "../src/lib/ai/analyzer";
import { generateTypstSource } from "../src/lib/renderer/typst/generator";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";
import type { BookStructureV1 } from "../src/lib/manuscript/types";

// --- PDF parser fixes (#4, #10, #11) ---------------------------------------

describe("pdf-parser: ordered list numbering (#4)", () => {
  it("groups wrapped list-item lines into a single multi-item list block", async () => {
    // root.pdf has 4 PRACTICE sections with ordered lists where wrapped
    // continuation lines were previously splitting each item into a separate
    // single-item list block.
    const buf = fs.readFileSync("root.pdf");
    const { blocks } = await parsePdf(buf);
    const orderedLists = blocks.filter((b) => b.type === "list_ordered");
    // The 4 practice sections should produce at least 4 multi-item lists.
    const multiItemLists = orderedLists.filter((b) => (b.items?.length || 0) >= 3);
    expect(multiItemLists.length).toBeGreaterThanOrEqual(4);
    // No list should be a single-item fragment from a wrapped line.
    for (const list of orderedLists) {
      expect(list.items?.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("pdf-parser: citation paragraph splitting (#10)", () => {
  it("does not split citations at initials like 'W. L.'", async () => {
    const buf = fs.readFileSync("root.pdf");
    const { blocks } = await parsePdf(buf);
    // The Neuhuber & Berthoud citation was previously split: block ending
    // "Neuhuber, W. L." followed by block starting "& Berthoud, H.-R. (2022)".
    const neuhuberBlock = blocks.find((b) => (b.text || "").includes("Neuhuber"));
    expect(neuhuberBlock).toBeDefined();
    expect(neuhuberBlock!.text).toContain("Berthoud");
    expect(neuhuberBlock!.text).toContain("2022");
  });
});

describe("pdf-parser: control character stripping (#11)", () => {
  it("strips control chars that would trigger font fallbacks", async () => {
    const buf = fs.readFileSync("root.pdf");
    const { rawText } = await parsePdf(buf);
    // No STX (U+0002) or BS (U+0008) control characters should remain.
    expect(rawText).not.toContain("\u0002");
    expect(rawText).not.toContain("\u0008");
  });
});

// --- Analyzer fixes (#2, #3, #4, #5, #7) -----------------------------------

describe("analyzer: front-matter splitting (#2/#3/#7)", () => {
  it("splits front matter into discrete typed entries", async () => {
    const buf = fs.readFileSync("root.pdf");
    const s = await analyzeManuscript(buf, "application/pdf", "root.pdf");
    // Should have title_page, copyright, epigraph(s), note, preface, toc.
    const types = s.frontMatter.map((f) => f.type);
    expect(types).toContain("title_page");
    expect(types).toContain("copyright");
    expect(types).toContain("toc");
    // Epigraphs should be separate entries, not merged into one paragraph.
    const epigraphs = s.frontMatter.filter((f) => f.type === "epigraph");
    expect(epigraphs.length).toBeGreaterThanOrEqual(3);
    // No "Front matter" pseudo-heading should be synthesized.
    expect(s.frontMatter.find((f) => f.title === "Front matter")).toBeUndefined();
  });
});

describe("analyzer: practice box detection (#4)", () => {
  it("converts PRACTICE sections into practice_box blocks", async () => {
    const buf = fs.readFileSync("root.pdf");
    const s = await analyzeManuscript(buf, "application/pdf", "root.pdf");
    // All 4 practice sections should be practice_box blocks within chapters.
    const practiceBoxes: { chapter: string; label: string; items: number }[] = [];
    for (const ch of s.chapters) {
      for (const sec of ch.sections) {
        for (const b of sec.blocks) {
          if (b.type === "practice_box") {
            const listBlock = b.blocks?.find((bb) => bb.type === "list_ordered");
            practiceBoxes.push({
              chapter: ch.title,
              label: b.label || "",
              items: listBlock?.items?.length || 0,
            });
          }
        }
      }
    }
    expect(practiceBoxes.length).toBe(4);
    // Each practice box should have a non-empty label and multiple list items.
    for (const pb of practiceBoxes) {
      expect(pb.label.length).toBeGreaterThan(0);
      expect(pb.items).toBeGreaterThanOrEqual(3);
    }
    // Practice sections should NOT be separate chapters.
    expect(s.chapters.find((c) => /^practice/i.test(c.title))).toBeUndefined();
  });
});

describe("analyzer: corrupted script warning (#5)", () => {
  it("flags corrupted Devanagari text with low character diversity", async () => {
    const buf = fs.readFileSync("root.pdf");
    const s = await analyzeManuscript(buf, "application/pdf", "root.pdf");
    const corruptedWarnings = s.warnings.filter((w) => w.code === "corrupted_script");
    expect(corruptedWarnings.length).toBeGreaterThan(0);
    expect(corruptedWarnings[0].message).toContain("Devanagari");
  });
});

describe("analyzer: chapter structure (#7)", () => {
  it("does not treat Preface or Contents as chapters", async () => {
    const buf = fs.readFileSync("root.pdf");
    const s = await analyzeManuscript(buf, "application/pdf", "root.pdf");
    const chapterTitles = s.chapters.map((c) => c.title);
    expect(chapterTitles).not.toContain("Preface");
    expect(chapterTitles).not.toContain("Contents");
  });
});

// --- Generator fixes (#1, #4, #6, #13) -------------------------------------

describe("generator: ToC dot-leader layout (#1)", () => {
  it("emits toc_entry blocks as grid rows, not flowing prose", () => {
    const structure: BookStructureV1 = {
      schemaVersion: 1,
      title: "Test",
      author: "Author",
      chapterCount: 1,
      estimatedPages: 5,
      warnings: [],
      frontMatter: [
        {
          type: "toc",
          title: "Contents",
          blocks: [
            { type: "toc_entry", text: "One · The Night the Floor Went", page: 5 },
            { type: "toc_entry", text: "Two · What the Ordinary Moment Shows", page: 6 },
          ],
        },
      ],
      chapters: [],
      backMatter: [],
    };
    const settings = getEffectiveSettings(getTemplate("classic"), "trim_6x9", {});
    const { source } = generateTypstSource({
      jobId: "toc-test",
      structure,
      settings,
      templateName: "classic",
    });
    // ToC entries should use grid() with dot-leader line, not plain paragraphs.
    expect(source).toContain("grid(");
    expect(source).toContain('dash: "dotted"');
    expect(source).not.toMatch(/^One · The Night.*$/m);
  });
});

describe("generator: practice box rendering (#4)", () => {
  it("emits practice_box blocks with border, tint, and PRACTICE eyebrow", () => {
    const structure: BookStructureV1 = {
      schemaVersion: 1,
      title: "Test",
      author: "Author",
      chapterCount: 1,
      estimatedPages: 5,
      warnings: [],
      frontMatter: [],
      chapters: [
        {
          number: 1,
          title: "Chapter One",
          wordCount: 100,
          sections: [
            {
              title: "",
              blocks: [
                { type: "paragraph", text: "Some body text." },
                {
                  type: "practice_box",
                  label: "Looking for the Looker",
                  blocks: [
                    { type: "list_ordered", items: ["Step one.", "Step two."] },
                  ],
                },
              ],
            },
          ],
        },
      ],
      backMatter: [],
    };
    const settings = getEffectiveSettings(getTemplate("classic"), "trim_6x9", {});
    const { source } = generateTypstSource({
      jobId: "practice-test",
      structure,
      settings,
      templateName: "classic",
    });
    expect(source).toContain("PRACTICE");
    expect(source).toContain("stroke:");
    expect(source).toContain("fill:");
    expect(source).toContain("Looking for the Looker");
  });
});

describe("generator: colophon is togglable (#13)", () => {
  it("passes showColophon to the template", () => {
    const structure: BookStructureV1 = {
      schemaVersion: 1,
      title: "Test",
      author: "Author",
      chapterCount: 0,
      estimatedPages: 1,
      warnings: [],
      frontMatter: [],
      chapters: [],
      backMatter: [],
    };
    const settings = getEffectiveSettings(getTemplate("classic"), "trim_6x9", {});
    const { source } = generateTypstSource({
      jobId: "colophon-test",
      structure,
      settings,
      templateName: "classic",
    });
    expect(source).toContain("showColophon: true");
  });
});

// --- End-to-end render test ------------------------------------------------

describe("end-to-end: root.pdf render", () => {
  it("renders root.pdf with no system font fallbacks (#11)", async () => {
    const buf = fs.readFileSync("root.pdf");
    const s = await analyzeManuscript(buf, "application/pdf", "root.pdf");
    const settings = getEffectiveSettings(getTemplate("philosophy"), "trim_6x9", {});
    const { source, images } = generateTypstSource({
      jobId: "font-audit-test",
      structure: s,
      settings,
      templateName: "philosophy",
    });
    // Compile and check for unwanted font fallbacks.
    const { compileTypst } = await import("../src/lib/renderer/typst/compiler");
    const path = await import("path");
    const { resolveAppRoot } = await import("../src/lib/app-root");
    const pdfBuffer = await compileTypst(
      source,
      path.join(resolveAppRoot(), "src", "lib", "renderer", "fonts"),
      images
    );
    const text = pdfBuffer.toString("latin1");
    expect(text).not.toContain("Roboto");
    expect(text).not.toContain("UbuntuMono");
    expect(text).not.toContain("LinLibertine");
  }, 60000);
});
