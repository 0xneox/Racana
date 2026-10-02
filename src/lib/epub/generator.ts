import JSZip from "jszip";
import type { BookStructureV1, Block, ChapterEntry, FrontMatterEntry, BackMatterEntry } from "../manuscript/types";

export interface EpubOptions {
  title: string;
  author?: string;
  language?: string;
  identifier?: string;
  publisher?: string;
  description?: string;
  structure: BookStructureV1;
  coverImageBuffer?: Buffer;
  coverMimeType?: string;
}

function escapeXml(unsafe: string = ""): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderBlockToHtml(block: Block, isFirstParagraph = false): string {
  switch (block.type) {
    case "paragraph": {
      const cls = isFirstParagraph ? ' class="first-p"' : "";
      return `<p${cls}>${escapeXml(block.text || "")}</p>`;
    }
    case "heading_h1":
      return `<h2>${escapeXml(block.text || "")}</h2>`;
    case "heading_h2":
      return `<h3>${escapeXml(block.text || "")}</h3>`;
    case "heading_h3":
      return `<h4>${escapeXml(block.text || "")}</h4>`;
    case "quote": {
      const attr = block.attribution
        ? `<cite>— ${escapeXml(block.attribution)}</cite>`
        : "";
      return `<blockquote><p>${escapeXml(block.text || "")}</p>${attr}</blockquote>`;
    }
    case "list_ordered": {
      const items = (block.items || []).map((it) => `<li>${escapeXml(it)}</li>`).join("");
      return `<ol>${items}</ol>`;
    }
    case "list_unordered": {
      const items = (block.items || []).map((it) => `<li>${escapeXml(it)}</li>`).join("");
      return `<ul>${items}</ul>`;
    }
    case "table": {
      if (!block.rows || block.rows.length === 0) return "";
      const rowsHtml = block.rows
        .map(
          (row) =>
            `<tr>${row.cells.map((c) => `<td>${escapeXml(c.text)}</td>`).join("")}</tr>`
        )
        .join("");
      return `<div class="table-wrap"><table><tbody>${rowsHtml}</tbody></table></div>`;
    }
    case "footnote":
      return `<aside epub:type="footnote" class="footnote"><p>${escapeXml(block.text || "")}</p></aside>`;
    case "epigraph": {
      const attr = block.attribution
        ? `<p class="epigraph-author">— ${escapeXml(block.attribution)}</p>`
        : "";
      return `<div class="epigraph"><p>${escapeXml(block.text || "")}</p>${attr}</div>`;
    }
    case "practice_box": {
      const label = block.label ? `<h5>${escapeXml(block.label)}</h5>` : "";
      const inner = (block.blocks || []).map((b) => renderBlockToHtml(b)).join("");
      return `<div class="practice-box">${label}${inner}</div>`;
    }
    case "image": {
      if (!block.src) return "";
      const caption = block.text ? `<figcaption>${escapeXml(block.text)}</figcaption>` : "";
      return `<figure class="book-figure"><img src="${escapeXml(block.src)}" alt="${escapeXml(block.alt || "")}" />${caption}</figure>`;
    }
    case "copyright":
      return `<div class="copyright-notice"><p>${escapeXml(block.text || "")}</p></div>`;
    default:
      return block.text ? `<p>${escapeXml(block.text)}</p>` : "";
  }
}

function buildXhtmlPage(title: string, bodyContent: string, isCover = false, lang = "en"): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(lang)}" lang="${escapeXml(lang)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css" />
  ${isCover ? '<meta name="viewport" content="width=device-width, height=device-height, initial-scale=1.0" />' : ""}
</head>
<body${isCover ? ' class="cover-page"' : ""}>
${bodyContent}
</body>
</html>`;
}

const EPUB_STYLES_CSS = `
@charset "utf-8";

body {
  margin: 5% 6%;
  padding: 0;
  font-family: "Georgia", "Merriweather", "Noto Serif", "Noto Serif Devanagari", "Noto Serif Bengali", "Noto Serif Tamil", serif;
  font-size: 1em;
  line-height: 1.6;
  color: #1a1a1a;
  background-color: transparent;
  text-rendering: optimizeLegibility;
}

body.cover-page {
  margin: 0;
  padding: 0;
  text-align: center;
}

.cover-wrapper {
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.cover-image {
  max-width: 100%;
  max-height: 100%;
  height: auto;
  object-fit: contain;
}

h1.book-title {
  font-size: 2.2em;
  line-height: 1.2;
  text-align: center;
  margin-top: 25vh;
  margin-bottom: 0.5em;
  font-weight: 700;
  letter-spacing: 0.05em;
}

h2.book-subtitle {
  font-size: 1.25em;
  text-align: center;
  margin-bottom: 2em;
  font-weight: 400;
  font-style: italic;
  color: #555;
}

p.book-author {
  font-size: 1.2em;
  text-align: center;
  margin-top: 3em;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

p.publisher-mark {
  font-size: 0.85em;
  text-align: center;
  margin-top: 25vh;
  color: #777;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

h1.chapter-title {
  font-size: 1.8em;
  line-height: 1.3;
  margin-top: 15vh;
  margin-bottom: 1.5em;
  text-align: center;
  font-weight: 600;
  page-break-before: always;
}

.chapter-number {
  display: block;
  font-size: 0.55em;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: #777;
  margin-bottom: 0.4em;
}

h2 {
  font-size: 1.4em;
  margin-top: 1.8em;
  margin-bottom: 0.6em;
  font-weight: 600;
}

h3 {
  font-size: 1.2em;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

p {
  margin: 0 0 0.8em 0;
  text-align: justify;
  text-indent: 1.5em;
}

p.first-p {
  text-indent: 0;
}

p.first-p::first-letter {
  font-size: 3em;
  float: left;
  line-height: 0.8;
  margin-right: 0.15em;
  margin-top: 0.05em;
  font-weight: bold;
}

blockquote {
  margin: 1.5em 2em;
  font-style: italic;
  color: #333;
  border-left: 2px solid #ccc;
  padding-left: 1em;
}

blockquote cite {
  display: block;
  text-align: right;
  font-size: 0.85em;
  font-style: normal;
  margin-top: 0.5em;
  color: #666;
}

.epigraph {
  margin: 20vh 15% 10vh 15%;
  font-style: italic;
  text-align: center;
}

.epigraph-author {
  text-align: right;
  font-size: 0.9em;
  margin-top: 1em;
  font-style: normal;
}

.practice-box {
  margin: 1.8em 0;
  padding: 1.2em 1.5em;
  border: 1px solid #d4af37;
  background-color: #faf8f5;
  border-radius: 4px;
}

.practice-box h5 {
  margin-top: 0;
  margin-bottom: 0.8em;
  font-size: 1em;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #8c3c1f;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5em 0;
}

td, th {
  border: 1px solid #ddd;
  padding: 0.6em;
  text-align: left;
}

figure.book-figure {
  margin: 2em 0;
  text-align: center;
}

figure.book-figure img {
  max-width: 100%;
  height: auto;
}

figure.book-figure figcaption {
  font-size: 0.85em;
  color: #666;
  margin-top: 0.5em;
  font-style: italic;
}

.footnote {
  font-size: 0.85em;
  color: #555;
  border-top: 1px solid #eee;
  padding-top: 0.8em;
  margin-top: 2em;
}

.copyright-notice {
  font-size: 0.85em;
  color: #666;
  text-align: center;
  margin-top: 30vh;
}

nav#toc ol {
  list-style-type: none;
  padding-left: 0;
}

nav#toc li {
  margin: 0.8em 0;
}

nav#toc a {
  text-decoration: none;
  color: #1a1a1a;
  border-bottom: 1px dotted #888;
}
`;

export async function generateEpub(options: EpubOptions): Promise<Buffer> {
  const zip = new JSZip();

  // 1. mimetype: MUST be the first file in the ZIP, uncompressed (STORE)
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // 2. META-INF/container.xml
  const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
  zip.file("META-INF/container.xml", containerXml);

  const title = options.title || options.structure.title || "Untitled Book";
  const author = options.author || options.structure.author || "Unknown Author";
  const scriptLang: Record<string, string> = {
    devanagari: "hi",
    bengali: "bn",
    gurmukhi: "pa",
    gujarati: "gu",
    odia: "or",
    tamil: "ta",
    telugu: "te",
    kannada: "kn",
    malayalam: "ml",
    "mixed-indic": "hi",
  };
  const language =
    options.language || scriptLang[options.structure.detectedScript || ""] || "en";
  const identifier = options.identifier || `urn:uuid:${Math.random().toString(36).substring(2)}-${Date.now()}`;
  const publisher = options.publisher || "Racana";
  const dateStr = new Date().toISOString().split("T")[0];

  const oebps = zip.folder("OEBPS")!;
  oebps.file("styles.css", EPUB_STYLES_CSS);

  const manifestItems: { id: string; href: string; mediaType: string; properties?: string }[] = [
    { id: "css", href: "styles.css", mediaType: "text/css" },
    { id: "nav", href: "nav.xhtml", mediaType: "application/xhtml+xml", properties: "nav" },
    { id: "ncx", href: "toc.ncx", mediaType: "application/x-dtbncx+xml" },
  ];

  const spineItemRefs: { idref: string }[] = [];
  const tocEntries: { label: string; href: string }[] = [];

  // Optional Cover
  let hasCover = false;
  if (options.coverImageBuffer && options.coverImageBuffer.length > 0) {
    hasCover = true;
    const coverExt = options.coverMimeType === "image/png" ? "png" : "jpg";
    const coverMime = options.coverMimeType || "image/jpeg";
    oebps.file(`images/cover.${coverExt}`, options.coverImageBuffer);
    manifestItems.push({
      id: "cover-image",
      href: `images/cover.${coverExt}`,
      mediaType: coverMime,
      properties: "cover-image",
    });

    const coverHtml = `
  <div class="cover-wrapper">
    <img src="images/cover.${coverExt}" alt="Cover" class="cover-image" />
  </div>`;
    oebps.file("cover.xhtml", buildXhtmlPage("Cover", coverHtml, true, language));
    manifestItems.push({
      id: "cover-page",
      href: "cover.xhtml",
      mediaType: "application/xhtml+xml",
    });
    spineItemRefs.push({ idref: "cover-page" });
  }

  // Title Page
  const titlePageHtml = `
  <div class="titlepage-wrapper">
    <h1 class="book-title">${escapeXml(title)}</h1>
    ${options.structure.subtitle ? `<h2 class="book-subtitle">${escapeXml(options.structure.subtitle)}</h2>` : ""}
    <p class="book-author">${escapeXml(author)}</p>
    <p class="publisher-mark">${escapeXml(publisher)}</p>
  </div>`;
  oebps.file("titlepage.xhtml", buildXhtmlPage("Title Page", titlePageHtml, false, language));
  manifestItems.push({
    id: "titlepage",
    href: "titlepage.xhtml",
    mediaType: "application/xhtml+xml",
  });
  spineItemRefs.push({ idref: "titlepage" });
  tocEntries.push({ label: "Title Page", href: "titlepage.xhtml" });

  // Front Matter
  const frontMatter = options.structure.frontMatter || [];
  frontMatter.forEach((fm: FrontMatterEntry, idx: number) => {
    const id = `frontmatter_${idx + 1}`;
    const filename = `${id}.xhtml`;
    const heading = fm.title || "Front Matter";
    const bodyContent = `
    <h1 class="chapter-title">${escapeXml(heading)}</h1>
    ${(fm.blocks || []).map((b, bIdx) => renderBlockToHtml(b, bIdx === 0)).join("")}`;
    oebps.file(filename, buildXhtmlPage(heading, bodyContent, false, language));
    manifestItems.push({ id, href: filename, mediaType: "application/xhtml+xml" });
    spineItemRefs.push({ idref: id });
    tocEntries.push({ label: heading, href: filename });
  });

  // Chapters
  const chapters = options.structure.chapters || [];
  chapters.forEach((chap: ChapterEntry, idx: number) => {
    const id = `chapter_${idx + 1}`;
    const filename = `${id}.xhtml`;
    const chapNumLabel = chap.number ? `Chapter ${chap.number}` : `Chapter ${idx + 1}`;
    const chapTitle = chap.title || chapNumLabel;

    let bodyContent = `
    <h1 class="chapter-title">
      <span class="chapter-number">${escapeXml(chapNumLabel)}</span>
      ${escapeXml(chap.title && chap.title !== chapNumLabel ? chap.title : "")}
    </h1>`;

    (chap.sections || []).forEach((sec) => {
      if (sec.title && sec.title !== chap.title) {
        bodyContent += `<h2>${escapeXml(sec.title)}</h2>`;
      }
      (sec.blocks || []).forEach((b, bIdx) => {
        bodyContent += renderBlockToHtml(b, bIdx === 0);
      });
    });

    oebps.file(filename, buildXhtmlPage(chapTitle, bodyContent, false, language));
    manifestItems.push({ id, href: filename, mediaType: "application/xhtml+xml" });
    spineItemRefs.push({ idref: id });
    tocEntries.push({ label: chapTitle, href: filename });
  });

  // Back Matter
  const backMatter = options.structure.backMatter || [];
  backMatter.forEach((bm: BackMatterEntry, idx: number) => {
    const id = `backmatter_${idx + 1}`;
    const filename = `${id}.xhtml`;
    const heading = bm.title || "Back Matter";
    const bodyContent = `
    <h1 class="chapter-title">${escapeXml(heading)}</h1>
    ${(bm.blocks || []).map((b, bIdx) => renderBlockToHtml(b, bIdx === 0)).join("")}`;
    oebps.file(filename, buildXhtmlPage(heading, bodyContent, false, language));
    manifestItems.push({ id, href: filename, mediaType: "application/xhtml+xml" });
    spineItemRefs.push({ idref: id });
    tocEntries.push({ label: heading, href: filename });
  });

  // EPUB 3 Navigation Document (nav.xhtml)
  const navHtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="en">
<head>
  <meta charset="utf-8" />
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="styles.css" />
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1 class="chapter-title">Table of Contents</h1>
    <ol>
      ${tocEntries
        .map((entry) => `<li><a href="${escapeXml(entry.href)}">${escapeXml(entry.label)}</a></li>`)
        .join("\n      ")}
    </ol>
  </nav>
</body>
</html>`;
  oebps.file("nav.xhtml", navHtml);

  // EPUB 2 NCX (toc.ncx) for legacy e-readers and Kindle compatibility
  const ncxXml = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(identifier)}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(title)}</text>
  </docTitle>
  <docAuthor>
    <text>${escapeXml(author)}</text>
  </docAuthor>
  <navMap>
    ${tocEntries
      .map(
        (entry, idx) => `
    <navPoint id="navPoint-${idx + 1}" playOrder="${idx + 1}">
      <navLabel><text>${escapeXml(entry.label)}</text></navLabel>
      <content src="${escapeXml(entry.href)}"/>
    </navPoint>`
      )
      .join("")}
  </navMap>
</ncx>`;
  oebps.file("toc.ncx", ncxXml);

  // Package Document (content.opf)
  const opfXml = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>${escapeXml(language)}</dc:language>
    <dc:publisher>${escapeXml(publisher)}</dc:publisher>
    <dc:date>${escapeXml(dateStr)}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.[0-9]+Z$/, "Z")}</meta>
    ${hasCover ? '<meta name="cover" content="cover-image"/>' : ""}
    ${options.description ? `<dc:description>${escapeXml(options.description)}</dc:description>` : ""}
  </metadata>
  <manifest>
    ${manifestItems
      .map(
        (item) =>
          `<item id="${escapeXml(item.id)}" href="${escapeXml(item.href)}" media-type="${escapeXml(item.mediaType)}"${
            item.properties ? ` properties="${escapeXml(item.properties)}"` : ""
          }/>`
      )
      .join("\n    ")}
  </manifest>
  <spine toc="ncx">
    ${spineItemRefs.map((ref) => `<itemref idref="${escapeXml(ref.idref)}"/>`).join("\n    ")}
  </spine>
</package>`;
  oebps.file("content.opf", opfXml);

  // Generate the EPUB binary as a Node.js Buffer
  const epubBuffer = await zip.generateAsync({
    type: "nodebuffer",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });

  return epubBuffer;
}
