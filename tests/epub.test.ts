import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { generateEpub } from "../src/lib/epub/generator";
import type { BookStructureV1 } from "../src/lib/manuscript/types";

describe("EPUB 3 Generator", () => {
  const sampleStructure: BookStructureV1 = {
    schemaVersion: 1,
    title: "Echoes of the Ganges",
    subtitle: "A Journey Through Ancient Temples",
    author: "Aarav Sharma",
    chapterCount: 2,
    estimatedPages: 120,
    detectedScript: "devanagari",
    scriptLabel: "Hindi · Devanagari",
    warnings: [],
    frontMatter: [
      {
        type: "preface",
        title: "Author's Preface",
        blocks: [
          { type: "paragraph", text: "Writing this book was a pilgrimage of the heart." },
          { type: "quote", text: "The river carries stories unseen by mortal eyes.", attribution: "Ancient Hymn" },
        ],
      },
    ],
    chapters: [
      {
        number: 1,
        title: "The Holy Confluence",
        wordCount: 1500,
        sections: [
          {
            title: "Morning Mist",
            blocks: [
              { type: "paragraph", text: "At dawn, the bells of Varanasi echoed across the water." },
              {
                type: "practice_box",
                label: "Reflective Contemplation",
                blocks: [{ type: "paragraph", text: "Breathe gently and observe the morning light." }],
              },
            ],
          },
        ],
      },
      {
        number: 2,
        title: "The Flame of Eternity",
        wordCount: 1200,
        sections: [
          {
            title: "Ghats at Twilight",
            blocks: [
              { type: "paragraph", text: "Thousands of earthen diyas floated into the darkness." },
            ],
          },
        ],
      },
    ],
    backMatter: [
      {
        type: "acknowledgments",
        title: "Acknowledgments",
        blocks: [
          { type: "paragraph", text: "Special thanks to my family, editors, and fellow travelers." },
        ],
      },
    ],
  };

  it("generates a valid EPUB 3 zip archive with all required structures", async () => {
    const epubBuffer = await generateEpub({
      title: sampleStructure.title,
      author: sampleStructure.author,
      structure: sampleStructure,
    });

    expect(epubBuffer).toBeDefined();
    expect(epubBuffer.length).toBeGreaterThan(500);

    // Read back with JSZip
    const zip = await JSZip.loadAsync(epubBuffer);

    // Verify mimetype is uncompressed at root
    const mimetypeFile = zip.file("mimetype");
    expect(mimetypeFile).toBeDefined();
    const mimetypeText = await mimetypeFile!.async("text");
    expect(mimetypeText.trim()).toBe("application/epub+zip");

    // Verify container.xml
    const container = zip.file("META-INF/container.xml");
    expect(container).toBeDefined();
    const containerText = await container!.async("text");
    expect(containerText).toContain("OEBPS/content.opf");

    // Verify content.opf
    const opf = zip.file("OEBPS/content.opf");
    expect(opf).toBeDefined();
    const opfText = await opf!.async("text");
    expect(opfText).toContain("<dc:title>Echoes of the Ganges</dc:title>");
    expect(opfText).toContain("<dc:creator>Aarav Sharma</dc:creator>");
    expect(opfText).toContain("titlepage.xhtml");
    expect(opfText).toContain("chapter_1.xhtml");
    expect(opfText).toContain("chapter_2.xhtml");

    // Verify nav.xhtml (EPUB 3 Navigation)
    const nav = zip.file("OEBPS/nav.xhtml");
    expect(nav).toBeDefined();
    const navText = await nav!.async("text");
    expect(navText).toContain("Table of Contents");
    expect(navText).toContain("The Holy Confluence");
    expect(navText).toContain("The Flame of Eternity");

    // Verify toc.ncx (EPUB 2 / Kindle compatibility)
    const ncx = zip.file("OEBPS/toc.ncx");
    expect(ncx).toBeDefined();
    const ncxText = await ncx!.async("text");
    expect(ncxText).toContain("Echoes of the Ganges");
    expect(ncxText).toContain("The Holy Confluence");

    // Verify chapters content
    const chap1 = zip.file("OEBPS/chapter_1.xhtml");
    expect(chap1).toBeDefined();
    const chap1Text = await chap1!.async("text");
    expect(chap1Text).toContain("The Holy Confluence");
    expect(chap1Text).toContain("Morning Mist");
    expect(chap1Text).toContain("At dawn, the bells of Varanasi echoed across the water.");
    expect(chap1Text).toContain("Reflective Contemplation");

    // Verify styles.css
    const css = zip.file("OEBPS/styles.css");
    expect(css).toBeDefined();
  });

  it("embeds a cover image when provided", async () => {
    // 1x1 dummy PNG
    const dummyPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64"
    );

    const epubBuffer = await generateEpub({
      title: "Covered Book",
      author: "Cover Author",
      structure: sampleStructure,
      coverImageBuffer: dummyPng,
      coverMimeType: "image/png",
    });

    const zip = await JSZip.loadAsync(epubBuffer);
    expect(zip.file("OEBPS/images/cover.png")).toBeDefined();
    expect(zip.file("OEBPS/cover.xhtml")).toBeDefined();

    const opfText = await zip.file("OEBPS/content.opf")!.async("text");
    expect(opfText).toContain('properties="cover-image"');
    expect(opfText).toContain('id="cover-page"');
  });
});
