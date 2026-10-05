import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { parseDocx } from "../src/lib/manuscript/docx-parser";
import { MARK, normalizeInline, resolveRich, stripInline, noteRef } from "../src/lib/manuscript/inline";
import { generateTypstSource } from "../src/lib/renderer/typst/generator";
import { generatePublication } from "../src/lib/renderer/publication-renderer";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";
import { buildEpub } from "../src/lib/epub/generator";
import { validateEpub } from "../src/lib/epub/validate";
import {
  COVER_PRESETS,
  coverGeometry,
  coverPhysicalSize,
  generateCoverSvg,
  spineWidthInches,
  type CoverDesignConfig,
} from "../src/lib/cover/generator";
import type { BookStructureV1 } from "../src/lib/manuscript/types";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

async function makeDocx(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/></Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/></Relationships>`
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>
<w:p><w:r><w:t xml:space="preserve">The </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>brave</w:t></w:r><w:r><w:t xml:space="preserve"> and </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>quiet</w:t></w:r><w:r><w:t xml:space="preserve"> cat slept.</w:t></w:r><w:r><w:footnoteReference w:id="1"/></w:r></w:p>
<w:p><w:r><w:t>A plain closing paragraph.</w:t></w:r></w:p>
</w:body></w:document>`
  );
  zip.file(
    "word/footnotes.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:footnotes ${W}>
<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>
<w:footnote w:id="1"><w:p><w:r><w:t xml:space="preserve">A </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>real</w:t></w:r><w:r><w:t xml:space="preserve"> note.</w:t></w:r></w:p></w:footnote>
</w:footnotes>`
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
);

const richPara = `The ${MARK.B_ON}brave${MARK.B_OFF} and ${MARK.I_ON}quiet${MARK.I_OFF} cat slept.${noteRef("footnote-1")}`;

function sampleStructure(): BookStructureV1 {
  return {
    schemaVersion: 1,
    title: "The Quiet Cat",
    author: "Asha Rao",
    chapterCount: 2,
    estimatedPages: 120,
    warnings: [],
    frontMatter: [
      { type: "toc", title: "Contents", blocks: [{ type: "toc_entry", text: "Chapter One", page: 7 }] },
    ],
    chapters: [
      { number: 0, title: "The Beginning", wordCount: 0, kind: "part", label: "Part One", sections: [] },
      {
        number: 1,
        title: "The Night",
        wordCount: 400,
        kind: "chapter",
        label: "Chapter One",
        sections: [
          {
            title: "",
            blocks: [
              { type: "paragraph", text: stripInline(richPara), rich: richPara, notes: { "footnote-1": `A ${MARK.I_ON}real${MARK.I_OFF} note.` } },
              { type: "paragraph", text: "Second paragraph & more." },
              { type: "heading_h2", text: "Morning" },
              { type: "paragraph", text: "After the heading, no indent." },
              { type: "image", alt: "A cat", src: `data:image/png;base64,${PNG_1x1.toString("base64")}` },
              { type: "image", alt: "Old scan", src: "data:image/bmp;base64,Qk0AAAAAAAAAAAAAAAAAAAAAAAAAAAAA" },
            ],
          },
        ],
      },
    ],
    backMatter: [],
  };
}

describe("inline formatting + footnotes survive the DOCX parser", () => {
  it("keeps bold, italic and footnote references as rich text, plain text stays clean", async () => {
    const { blocks } = await parseDocx(await makeDocx());
    const para = blocks.find((b) => b.text?.startsWith("The brave"))!;
    expect(para.text).toBe("The brave and quiet cat slept.");
    expect(para.rich).toContain(`${MARK.B_ON}brave${MARK.B_OFF}`);
    expect(para.rich).toContain(`${MARK.I_ON}quiet${MARK.I_OFF}`);
    expect(para.rich).toContain(noteRef("footnote-1"));
    expect(stripInline(para.notes?.["footnote-1"])).toBe("A real note.");
    // Footnote bodies never leak into the text as a numbered list.
    expect(blocks.some((b) => b.type === "list_ordered")).toBe(false);
    expect(blocks.some((b) => (b.text || "").includes("↑"))).toBe(false);
  });

  it("drops rich text once a later pass rewrote the plain text", () => {
    expect(resolveRich("The brave and quiet cat slept.", richPara)).toBeTruthy();
    expect(resolveRich("Something else entirely.", richPara)).toBeNull();
    expect(normalizeInline(`${MARK.B_ON}${MARK.B_OFF}x${MARK.I_ON} ${MARK.I_OFF}`)).toBe("x ");
  });
});

describe("print interior renders inline formatting and footnotes", () => {
  it("emits strong/emph/footnote markup that compiles", async () => {
    const structure = sampleStructure();
    const settings = getEffectiveSettings(getTemplate("classic"), "trim_6x9", {});
    const { source } = generateTypstSource({ jobId: "rich", structure, settings, templateName: "classic" });
    expect(source).toContain("#strong[brave];");
    expect(source).toContain("#emph[quiet];");
    expect(source).toMatch(/#footnote\[A #emph\[real\]; note\.\];/);

    const { pdfBuffer, qaResult } = await generatePublication({ jobId: "rich", structure, settings, templateName: "classic" });
    expect(pdfBuffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(qaResult.pageCount).toBeGreaterThan(0);
  }, 120000);
});

describe("Kindle EPUB", () => {
  it("is structurally valid with packaged images, linked footnotes and nested parts", async () => {
    const { buffer, warnings } = await buildEpub({
      title: "The Quiet Cat",
      author: "Asha Rao",
      identifier: "urn:uuid:00000000-0000-4000-8000-000000000001",
      structure: sampleStructure(),
      coverImageBuffer: PNG_1x1,
      coverMimeType: "image/png",
    });
    expect(await validateEpub(buffer)).toEqual([]);

    const zip = await JSZip.loadAsync(buffer);
    const opf = await zip.file("OEBPS/content.opf")!.async("text");
    expect(opf).toContain('properties="cover-image"');
    expect(opf).toContain('href="images/img-1.png"');
    expect(opf).not.toContain("cover.xhtml");
    expect(opf).toContain('<itemref idref="nav"/>');
    expect(opf).toContain('<reference type="text" title="Start Reading" href="chapter_1.xhtml"/>');
    expect(opf).not.toContain("<dc:publisher>");

    const ch2 = await zip.file("OEBPS/chapter_2.xhtml")!.async("text");
    expect(ch2).toContain("<strong>brave</strong>");
    expect(ch2).toContain("<em>quiet</em>");
    expect(ch2).toContain('epub:type="noteref"');
    expect(ch2).toMatch(/<aside epub:type="footnote" class="footnote" id="fn-1">.*A <em>real<\/em> note\./);
    expect(ch2).toContain('<span class="chapter-label">Chapter One</span>The Night');
    // The small-caps lead would cut across the bold run, so it is skipped.
    expect(ch2).toContain('<p class="first-p">The <strong>brave</strong>');
    expect(ch2).not.toContain('<span class="lead-in">');
    expect(ch2).toContain("<p>Second paragraph &amp; more.</p>");
    expect(ch2).toContain('<h2>Morning</h2>\n<p class="noindent">After the heading, no indent.</p>');
    expect(ch2).not.toContain("data:image");
    expect(ch2).toContain("[Old scan]");
    expect(warnings.join(" ")).toMatch(/Old scan.*BMP/);

    const part = await zip.file("OEBPS/chapter_1.xhtml")!.async("text");
    expect(part).toContain('<span class="chapter-label">Part One</span>The Beginning');
    expect(part).not.toMatch(/Chapter \d/);

    const nav = await zip.file("OEBPS/nav.xhtml")!.async("text");
    expect(nav).toMatch(/Part One: The Beginning<\/a>\s*<ol>\s*<li><a href="chapter_2\.xhtml">Chapter One: The Night/);
    expect(nav).toContain('epub:type="landmarks"');
    // The manuscript's print ToC (with page numbers) is not carried over.
    expect(zip.file("OEBPS/frontmatter_1.xhtml")).toBeNull();

    const css = await zip.file("OEBPS/styles.css")!.async("text");
    expect(css).not.toMatch(/\bvh\b|color:\s*#|background|::first-letter|@font-face/);
  });

  it("validator catches broken packages", async () => {
    const zip = new JSZip();
    zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
    zip.file("META-INF/container.xml", '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>');
    zip.file(
      "OEBPS/content.opf",
      '<package><metadata><dc:identifier>x</dc:identifier><dc:title>t</dc:title><dc:language>en</dc:language></metadata><manifest><item id="c" href="c.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="missing"/></spine></package>'
    );
    zip.file("OEBPS/c.xhtml", '<html><body><p><img src="data:image/png;base64,AA"></p></body></html>');
    const issues = (await validateEpub(await zip.generateAsync({ type: "nodebuffer" }))).map((i) => i.message).join("\n");
    expect(issues).toMatch(/dcterms:modified/);
    expect(issues).toMatch(/navigation document/);
    expect(issues).toMatch(/unknown id "missing"/);
    expect(issues).toMatch(/must be self-closed/);
    expect(issues).toMatch(/data: URI/);
  });
});

describe("KDP paperback cover geometry", () => {
  const base: CoverDesignConfig = {
    title: "The Quiet Cat",
    author: "Asha Rao",
    palette: COVER_PRESETS[0].palette,
    typography: COVER_PRESETS[0].typography,
    ornament: "lotus",
    layoutStyle: "centered",
    format: "paperback",
    pageCount: 300,
  };

  it("uses KDP's full-wrap size: 2×(trim+0.125) + spine by trim + 0.25", () => {
    const white = coverPhysicalSize({ ...base, trimSize: "6x9", paper: "white" });
    expect(white.hIn).toBeCloseTo(9.25, 6);
    expect(white.wIn).toBeCloseTo(12.25 + 300 * 0.002252, 6);
    const cream = coverPhysicalSize({ ...base, trimSize: "5.5x8.5", paper: "cream" });
    expect(cream.hIn).toBeCloseTo(8.75, 6);
    expect(cream.wIn).toBeCloseTo(11.25 + 0.75, 6);
    expect(spineWidthInches(300, "white")).toBeCloseTo(0.6756, 4);
  });

  it("keeps the SVG aspect equal to the physical aspect (no stretch on export)", () => {
    for (const trimSize of ["5x8", "5.5x8.5", "6x9", "8.5x11"] as const) {
      const cfg = { ...base, trimSize, paper: "white" as const };
      const g = coverGeometry(cfg);
      const { wIn, hIn } = coverPhysicalSize(cfg);
      expect(g.width / g.panelH).toBeCloseTo(wIn / hIn, 2);
      expect(generateCoverSvg(cfg)).toContain(`viewBox="0 0 ${g.width} ${g.panelH}"`);
    }
    expect(coverGeometry({ ...base, format: "ebook" }).panelH / 800).toBeCloseTo(1.6, 6);
  });

  it("omits spine text at 79 pages and below, per KDP", () => {
    const svg = (pageCount: number) => generateCoverSvg({ ...base, pageCount, spineText: "SPINE-LABEL" });
    expect(svg(79)).not.toContain("SPINE-LABEL");
    expect(svg(80)).toContain("SPINE-LABEL");
  });
});
