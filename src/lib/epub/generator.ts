import { randomUUID } from "crypto";
import JSZip from "jszip";
import type { BookStructureV1, Block, ChapterEntry } from "../manuscript/types";
import { resolveRich, tokenizeInline, type InlineToken } from "../manuscript/inline";
import { imageFormat } from "../renderer/image-check";
import { resolveChapterOpener, smallcapsLead } from "../renderer/typst/generator";

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

export interface EpubBuildResult {
  buffer: Buffer;
  /** Non-fatal content problems (e.g. images Kindle can't display). */
  warnings: string[];
}

function escapeXml(unsafe: string = ""): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Text node → XHTML: escaped, control chars dropped, soft line breaks kept.
function escapeText(s: string): string {
  return escapeXml(s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")).replace(/\r?\n/g, "<br/>");
}

// Kindle (and every EPUB reading system) handles these natively.
const KINDLE_IMAGE_TYPES: Record<string, { ext: string; mime: string }> = {
  png: { ext: "png", mime: "image/png" },
  jpeg: { ext: "jpg", mime: "image/jpeg" },
  gif: { ext: "gif", mime: "image/gif" },
};
const DATA_URI = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/s;

const SCRIPT_LANG: Record<string, string> = {
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

// Kindle-safe stylesheet: no body margins, no forced text colours or
// backgrounds (they break dark/sepia modes), no viewport units, borders use
// currentColor.  Fonts are left to the reader's device — embedding them would
// raise the per-MB KDP delivery fee and Kindle lets readers override them.
const EPUB_STYLES_CSS = `@charset "utf-8";

p { margin: 0; text-indent: 1.2em; }
p.noindent, p.first-p { text-indent: 0; }
.lead-in { font-variant: small-caps; letter-spacing: 0.04em; }

h1, h2, h3, h4 { page-break-after: avoid; hyphens: none; -webkit-hyphens: none; }
h1.chapter-title { font-size: 1.6em; line-height: 1.25; text-align: center; font-weight: normal; margin: 2.5em 0 1.5em 0; page-break-before: always; }
.chapter-label { display: block; font-size: 0.55em; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 0.6em; }
.part-page h1.chapter-title { margin-top: 6em; }
p.part-subtitle { text-align: center; text-indent: 0; font-style: italic; }
h2 { font-size: 1.25em; font-weight: bold; margin: 1.5em 0 0.6em 0; }
h3 { font-size: 1.1em; font-weight: bold; margin: 1.2em 0 0.5em 0; }

blockquote { margin: 1em 1.5em; font-style: italic; }
blockquote p { text-indent: 0; }
blockquote cite { display: block; text-align: right; font-style: normal; font-size: 0.9em; margin-top: 0.4em; }
.epigraph { margin: 3em 10% 2em 10%; text-align: center; font-style: italic; }
.epigraph p { text-indent: 0; }
.epigraph p.epigraph-author { text-align: right; font-style: normal; font-size: 0.9em; margin-top: 0.6em; }

.practice-box { margin: 1.5em 0; padding: 0.8em 1em; border: 1px solid; }
.practice-box h4 { margin: 0 0 0.5em 0; font-size: 0.9em; letter-spacing: 0.1em; text-transform: uppercase; }
.practice-box p { text-indent: 0; margin-bottom: 0.4em; }

ul, ol { margin: 0.8em 0 0.8em 1.5em; padding: 0; }
table { border-collapse: collapse; margin: 1em 0; }
td, th { border: 1px solid; padding: 0.3em 0.5em; text-align: left; vertical-align: top; }

figure.book-figure { margin: 1.5em 0; text-align: center; page-break-inside: avoid; }
figure.book-figure img { max-width: 100%; }
figcaption { font-size: 0.85em; font-style: italic; margin-top: 0.4em; }
p.img-missing { text-align: center; text-indent: 0; font-style: italic; }

sup { font-size: 0.7em; vertical-align: super; line-height: 0; }
a.noteref { text-decoration: none; }
section.notes { margin-top: 2.5em; border-top: 1px solid; padding-top: 0.6em; }
aside.footnote { font-size: 0.85em; margin: 0 0 0.6em 0; }
aside.footnote p { text-indent: 0; }

.titlepage { text-align: center; }
.titlepage p { text-indent: 0; }
h1.book-title { font-size: 2em; line-height: 1.2; margin: 3em 0 0.4em 0; }
p.book-subtitle { font-size: 1.2em; font-style: italic; }
p.book-author { margin-top: 2.5em; font-size: 1.1em; letter-spacing: 0.08em; text-transform: uppercase; }
p.publisher-mark { margin-top: 4em; font-size: 0.85em; letter-spacing: 0.15em; text-transform: uppercase; }

.display-page { margin-top: 4em; text-align: center; font-style: italic; }
.display-page p { text-indent: 0; margin-bottom: 0.6em; }
.copyright-notice { margin-top: 4em; font-size: 0.85em; text-align: center; }
.copyright-notice p { text-indent: 0; margin-bottom: 0.5em; }

nav#toc ol { list-style-type: none; margin: 0; padding-left: 0; }
nav#toc ol ol { padding-left: 1.5em; }
nav#toc li { margin: 0.5em 0; }
nav#toc a { text-decoration: none; }
`;

interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

interface TocEntry {
  label: string;
  href: string;
  children: TocEntry[];
}

// Per-book render state: image + footnote counters are global so ids stay
// unique across files; notes are flushed at the end of each XHTML file.
class RenderState {
  imageCount = 0;
  noteCount = 0;
  pendingNotes: string[] = [];
  warnings: string[] = [];
  constructor(private oebps: JSZip, private manifest: ManifestItem[]) {}

  addImage(src: string, alt: string): string | null {
    const m = src.match(DATA_URI);
    if (!m) return null;
    let buf: Buffer;
    try {
      buf = Buffer.from(m[1], "base64");
    } catch {
      return null;
    }
    const fmt = imageFormat(buf);
    const type = fmt ? KINDLE_IMAGE_TYPES[fmt] : undefined;
    if (!type) {
      this.warnings.push(
        `Image "${alt || `#${this.imageCount + 1}`}" is ${fmt ? fmt.toUpperCase() : "an unknown format"}, which Kindle can't display — re-insert it as JPG or PNG.`
      );
      return null;
    }
    this.imageCount++;
    const href = `images/img-${this.imageCount}.${type.ext}`;
    this.oebps.file(href, buf);
    this.manifest.push({ id: `img-${this.imageCount}`, href, mediaType: type.mime });
    return href;
  }

  noteRef(body: string): string {
    const n = ++this.noteCount;
    this.pendingNotes.push(
      `<aside epub:type="footnote" class="footnote" id="fn-${n}"><p><a href="#fnref-${n}">${n}.</a> ${renderTokens(tokenizeInline(body), this, undefined)}</p></aside>`
    );
    return `<sup><a epub:type="noteref" class="noteref" id="fnref-${n}" href="#fn-${n}">${n}</a></sup>`;
  }

  flushNotes(): string {
    if (this.pendingNotes.length === 0) return "";
    const html = `\n<section class="notes" epub:type="footnotes">\n${this.pendingNotes.join("\n")}\n</section>`;
    this.pendingNotes = [];
    return html;
  }
}

function renderTokens(tokens: InlineToken[], st: RenderState, notes?: Record<string, string>): string {
  return tokens
    .map((t) => {
      if (t.kind === "note") return notes?.[t.id] ? st.noteRef(notes[t.id]) : "";
      let out = escapeText(t.text);
      if (!t.text.trim()) return out;
      if (t.italic) out = `<em>${out}</em>`;
      if (t.bold) out = `<strong>${out}</strong>`;
      return out;
    })
    .join("");
}

function richHtml(st: RenderState, plain: string | undefined, rich?: string, notes?: Record<string, string>): string {
  const r = resolveRich(plain, rich);
  if (r) return renderTokens(tokenizeInline(r), st, notes);
  // Anchors lost to a later text rewrite: keep the notes, at paragraph end.
  return escapeText(plain || "") + Object.values(notes || {}).map((b) => st.noteRef(b)).join("");
}

const blockHtml = (st: RenderState, b: Block) => richHtml(st, b.text, b.rich, b.notes);

// Chapter openers set the first words in small caps — Latin text only, and
// only when those words sit in an unstyled first run.
function leadInParagraph(st: RenderState, b: Block): string {
  const text = (b.text || "").trim();
  const lead = smallcapsLead(text);
  const rich = resolveRich(text, b.rich);
  const tokens: InlineToken[] = rich ? tokenizeInline(rich) : [{ kind: "text", text, bold: false, italic: false }];
  const first = tokens[0];
  if (lead && first?.kind === "text" && !first.bold && !first.italic && first.text.startsWith(lead)) {
    const rest = [{ ...first, text: first.text.slice(lead.length) }, ...tokens.slice(1)];
    const orphan = rich ? "" : Object.values(b.notes || {}).map((n) => st.noteRef(n)).join("");
    return `<p class="first-p"><span class="lead-in">${escapeText(lead)}</span>${renderTokens(rest, st, b.notes)}${orphan}</p>`;
  }
  return `<p class="first-p">${blockHtml(st, b)}</p>`;
}

function renderBlock(st: RenderState, block: Block, pClass?: string): string {
  switch (block.type) {
    case "paragraph":
    case "noindent_paragraph":
    case "caption":
    case "reference":
    case "bibliography": {
      const cls = pClass || (block.type === "noindent_paragraph" ? "noindent" : "");
      return `<p${cls ? ` class="${cls}"` : ""}>${blockHtml(st, block)}</p>`;
    }
    case "heading_h1":
    case "heading_h2":
      return `<h2>${escapeText(block.text || "")}</h2>`;
    case "heading_h3":
      return `<h3>${escapeText(block.text || "")}</h3>`;
    case "quote": {
      const attr = block.attribution ? `<cite>— ${escapeText(block.attribution)}</cite>` : "";
      return `<blockquote><p>${blockHtml(st, block)}</p>${attr}</blockquote>`;
    }
    case "list_ordered":
    case "list_unordered": {
      const tag = block.type === "list_ordered" ? "ol" : "ul";
      const items = (block.items || [])
        .map((it, i) => `<li>${richHtml(st, it, block.richItems?.[i], block.notes)}</li>`)
        .join("");
      return items ? `<${tag}>${items}</${tag}>` : "";
    }
    case "table": {
      if (!block.rows || block.rows.length === 0) return "";
      const rowsHtml = block.rows
        .map((row) => `<tr>${row.cells.map((c) => `<td>${richHtml(st, c.text, c.rich)}</td>`).join("")}</tr>`)
        .join("");
      return `<table><tbody>${rowsHtml}</tbody></table>`;
    }
    case "footnote":
      // A free-standing note (no anchor in the text): attach it in place.
      return block.text ? `<p class="noindent">${st.noteRef(block.rich || block.text)}</p>` : "";
    case "epigraph": {
      const attr = block.attribution ? `<p class="epigraph-author">— ${escapeText(block.attribution)}</p>` : "";
      return `<div class="epigraph"><p>${blockHtml(st, block)}</p>${attr}</div>`;
    }
    case "practice_box": {
      const label = block.label ? `<h4>${escapeText(block.label)}</h4>` : "";
      const inner = (block.blocks || []).map((b) => renderBlock(st, b)).join("");
      return `<div class="practice-box">${label}${inner}</div>`;
    }
    case "image": {
      const alt = (block.alt || block.text || "").trim();
      const href = block.src ? st.addImage(block.src, alt) : null;
      if (!href) return alt ? `<p class="img-missing">[${escapeText(alt)}]</p>` : "";
      const caption = block.text ? `<figcaption>${escapeText(block.text)}</figcaption>` : "";
      return `<figure class="book-figure"><img src="${escapeXml(href)}" alt="${escapeXml(alt)}"/>${caption}</figure>`;
    }
    case "copyright":
      return `<div class="copyright-notice"><p>${escapeText(block.text || "")}</p></div>`;
    case "toc_entry":
      return ""; // the manuscript's own ToC has print page numbers; nav.xhtml replaces it
    default:
      return block.text ? `<p>${blockHtml(st, block)}</p>` : "";
  }
}

// Body blocks with book conventions: no indent after a heading, the first
// paragraph of a chapter gets the small-caps lead-in.
function renderBody(st: RenderState, blocks: Block[], opts: { leadIn?: boolean; afterHeading?: boolean } = {}): string {
  let leadPending = !!opts.leadIn;
  let afterHeading = opts.afterHeading ?? true;
  return blocks
    .map((b) => {
      if (b.type === "paragraph" && leadPending) {
        leadPending = false;
        afterHeading = false;
        return leadInParagraph(st, b);
      }
      const html = renderBlock(st, b, b.type === "paragraph" && afterHeading ? "noindent" : undefined);
      afterHeading = b.type.startsWith("heading");
      return html;
    })
    .join("\n");
}

function buildXhtmlPage(title: string, body: string, lang: string, bodyClass?: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${escapeXml(lang)}" lang="${escapeXml(lang)}">
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
${body}
</body>
</html>`;
}

const normalizeLine = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

interface ChapterHeading {
  label: string;
  title: string;
  subtitle?: string;
  isPart: boolean;
  tocLabel: string;
}

function chapterHeading(chap: ChapterEntry, sequence: number): ChapterHeading {
  const opener = chap.kind
    ? { kind: chap.kind, number: chap.number || 0, label: chap.label || "", title: chap.title || "", subtitle: chap.subtitle }
    : resolveChapterOpener(chap.title || "", sequence);
  const isPart = opener.kind === "part";
  let label = opener.label;
  if (!label && opener.kind === "chapter" && opener.number > 0) label = `Chapter ${opener.number}`;
  let title = opener.title;
  if (title && normalizeLine(title) === normalizeLine(label)) title = "";
  // "Chapter 3: The Night" stored as the title when the label is separate.
  if (label && title && normalizeLine(title).startsWith(normalizeLine(label))) {
    title = title.slice(label.length).replace(/^[\s:.\-—–·]+/, "");
  }
  const tocLabel = [label, title].filter(Boolean).join(": ") || (isPart ? "Part" : `Chapter ${sequence}`);
  return { label, title, subtitle: opener.subtitle, isPart, tocLabel };
}

export async function buildEpub(options: EpubOptions): Promise<EpubBuildResult> {
  const zip = new JSZip();

  // 1. mimetype: MUST be the first file in the ZIP, uncompressed (STORE)
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  // 2. META-INF/container.xml
  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const { structure } = options;
  const title = options.title || structure.title || "Untitled Book";
  const author = options.author || structure.author || "";
  const language = options.language || SCRIPT_LANG[structure.detectedScript || ""] || "en";
  const identifier = options.identifier || `urn:uuid:${randomUUID()}`;
  const publisher = options.publisher || "";

  const oebps = zip.folder("OEBPS")!;
  oebps.file("styles.css", EPUB_STYLES_CSS);

  const manifest: ManifestItem[] = [
    { id: "css", href: "styles.css", mediaType: "text/css" },
    { id: "nav", href: "nav.xhtml", mediaType: "application/xhtml+xml", properties: "nav" },
    { id: "ncx", href: "toc.ncx", mediaType: "application/x-dtbncx+xml" },
  ];
  const spine: string[] = [];
  const toc: TocEntry[] = [];
  const st = new RenderState(oebps, manifest);

  const addPage = (id: string, pageTitle: string, body: string, bodyClass?: string) => {
    const href = `${id}.xhtml`;
    oebps.file(href, buildXhtmlPage(pageTitle, body + st.flushNotes(), language, bodyClass));
    manifest.push({ id, href, mediaType: "application/xhtml+xml" });
    spine.push(id);
    return href;
  };

  // Cover image: marked as the package cover so Kindle / Play Books use it
  // for the library thumbnail.  No HTML cover page — KDP adds its own from
  // the uploaded marketing cover, and a second one would show twice.
  let hasCover = false;
  if (options.coverImageBuffer && options.coverImageBuffer.length > 0) {
    const fmt = imageFormat(options.coverImageBuffer);
    const type = (fmt && KINDLE_IMAGE_TYPES[fmt]) || (options.coverMimeType === "image/png" ? KINDLE_IMAGE_TYPES.png : KINDLE_IMAGE_TYPES.jpeg);
    oebps.file(`images/cover.${type.ext}`, options.coverImageBuffer);
    manifest.push({ id: "cover-image", href: `images/cover.${type.ext}`, mediaType: type.mime, properties: "cover-image" });
    hasCover = true;
  }

  // Title page
  addPage(
    "titlepage",
    "Title Page",
    `<div class="titlepage" epub:type="titlepage">
  <h1 class="book-title">${escapeText(title)}</h1>
  ${structure.subtitle ? `<p class="book-subtitle">${escapeText(structure.subtitle)}</p>` : ""}
  ${author ? `<p class="book-author">${escapeText(author)}</p>` : ""}
  ${publisher ? `<p class="publisher-mark">${escapeText(publisher)}</p>` : ""}
</div>`
  );

  // The HTML table of contents is in the reading order (KDP requires an
  // inline ToC); nav.xhtml doubles as it.
  spine.push("nav");

  // Front matter
  const metaLines = new Set([title, structure.subtitle, author].filter(Boolean).map((s) => normalizeLine(s!)));
  (structure.frontMatter || []).forEach((fm, idx) => {
    if (fm.type === "toc") return;
    let blocks = fm.blocks || [];
    if (fm.type === "title_page") {
      blocks = blocks.filter((b) => {
        const t = normalizeLine(b.text || "");
        if (!t) return b.type === "image";
        if (metaLines.has(t)) return false;
        return !(/^(by|written by)\s+/i.test(t) && author && t.endsWith(normalizeLine(author)));
      });
    }
    if (blocks.length === 0) return;
    const id = `frontmatter_${idx + 1}`;
    if (fm.type === "copyright") {
      addPage(id, "Copyright", `<div class="copyright-notice" epub:type="copyright-page">${blocks.map((b) => `<p>${blockHtml(st, b)}</p>`).join("\n")}</div>`);
      return;
    }
    if (fm.type === "title_page" || fm.type === "epigraph" || fm.type === "dedication" || !fm.title) {
      const epubType = fm.type === "dedication" ? ' epub:type="dedication"' : fm.type === "epigraph" ? ' epub:type="epigraph"' : "";
      addPage(id, fm.title || "Opening", `<div class="display-page"${epubType}>${renderBody(st, blocks)}</div>`);
      return;
    }
    const href = addPage(id, fm.title, `<h1 class="chapter-title">${escapeText(fm.title)}</h1>\n${renderBody(st, blocks)}`);
    toc.push({ label: fm.title, href, children: [] });
  });

  // Chapters — part dividers become ToC groups for the chapters under them.
  let firstBodyHref = "";
  let currentPart: TocEntry | null = null;
  let sequence = 0;
  (structure.chapters || []).forEach((chap, idx) => {
    if ((chap.kind ?? "chapter") === "chapter") sequence++;
    const h = chapterHeading(chap, sequence);
    const id = `chapter_${idx + 1}`;
    const labelHtml = h.label ? `<span class="chapter-label">${escapeText(h.label)}</span>` : "";
    let body = `<h1 class="chapter-title">${labelHtml}${escapeText(h.title)}</h1>`;
    if (h.subtitle) body += `\n<p class="part-subtitle">${escapeText(h.subtitle)}</p>`;
    let leadIn = !h.isPart;
    for (const sec of chap.sections || []) {
      if (sec.title && normalizeLine(sec.title) !== normalizeLine(chap.title || "")) {
        body += `\n<${(sec.level ?? 2) >= 3 ? "h3" : "h2"}>${escapeText(sec.title)}</${(sec.level ?? 2) >= 3 ? "h3" : "h2"}>`;
      }
      body += "\n" + renderBody(st, sec.blocks || [], { leadIn });
      if ((sec.blocks || []).some((b) => b.type === "paragraph")) leadIn = false;
    }
    const href = addPage(id, h.tocLabel, body, h.isPart ? "part-page" : undefined);
    if (!firstBodyHref) firstBodyHref = href;
    const entry: TocEntry = { label: h.tocLabel, href, children: [] };
    if (h.isPart) {
      currentPart = entry;
      toc.push(entry);
    } else if (chap.kind === "matter") {
      currentPart = null;
      toc.push(entry);
    } else if (currentPart) {
      currentPart.children.push(entry);
    } else {
      toc.push(entry);
    }
  });

  // Back matter
  (structure.backMatter || []).forEach((bm, idx) => {
    const heading = bm.title || "Notes";
    const href = addPage(`backmatter_${idx + 1}`, heading, `<h1 class="chapter-title">${escapeText(heading)}</h1>\n${renderBody(st, bm.blocks || [])}`);
    toc.push({ label: heading, href, children: [] });
  });

  const startHref = firstBodyHref || toc[0]?.href || "titlepage.xhtml";

  // EPUB 3 navigation document — also the in-book HTML table of contents.
  const navList = (entries: TocEntry[], indent: string): string =>
    entries
      .map((e) => {
        const kids = e.children.length ? `\n${indent}  <ol>\n${navList(e.children, indent + "    ")}\n${indent}  </ol>\n${indent}` : "";
        return `${indent}<li><a href="${escapeXml(e.href)}">${escapeText(e.label)}</a>${kids}</li>`;
      })
      .join("\n");
  oebps.file(
    "nav.xhtml",
    buildXhtmlPage(
      "Contents",
      `<nav epub:type="toc" id="toc">
  <h1 class="chapter-title">Contents</h1>
  <ol>
${navList(toc, "    ")}
  </ol>
</nav>
<nav epub:type="landmarks" id="landmarks" hidden="hidden">
  <ol>
    <li><a epub:type="toc" href="nav.xhtml#toc">Contents</a></li>
    <li><a epub:type="bodymatter" href="${escapeXml(startHref)}">Start Reading</a></li>
  </ol>
</nav>`,
      language
    )
  );

  // EPUB 2 NCX for legacy readers and older Kindle conversion paths.
  let playOrder = 0;
  const navPoints = (entries: TocEntry[], indent: string): string =>
    entries
      .map((e) => {
        const n = ++playOrder;
        return `${indent}<navPoint id="navPoint-${n}" playOrder="${n}">
${indent}  <navLabel><text>${escapeXml(e.label)}</text></navLabel>
${indent}  <content src="${escapeXml(e.href)}"/>
${navPoints(e.children, indent + "  ")}${indent}</navPoint>\n`;
      })
      .join("");
  const depth = toc.some((e) => e.children.length) ? 2 : 1;
  oebps.file(
    "toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${escapeXml(language)}">
  <head>
    <meta name="dtb:uid" content="${escapeXml(identifier)}"/>
    <meta name="dtb:depth" content="${depth}"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  ${author ? `<docAuthor><text>${escapeXml(author)}</text></docAuthor>` : ""}
  <navMap>
${navPoints(toc, "    ")}  </navMap>
</ncx>`
  );

  // Package document
  const modified = new Date().toISOString().replace(/\.[0-9]+Z$/, "Z");
  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId" xml:lang="${escapeXml(language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    ${author ? `<dc:creator id="creator">${escapeXml(author)}</dc:creator>\n    <meta refines="#creator" property="role" scheme="marc:relators">aut</meta>` : ""}
    <dc:language>${escapeXml(language)}</dc:language>
    ${publisher ? `<dc:publisher>${escapeXml(publisher)}</dc:publisher>` : ""}
    <dc:date>${modified.slice(0, 10)}</dc:date>
    <meta property="dcterms:modified">${modified}</meta>
    ${hasCover ? '<meta name="cover" content="cover-image"/>' : ""}
    ${options.description ? `<dc:description>${escapeXml(options.description)}</dc:description>` : ""}
  </metadata>
  <manifest>
    ${manifest
      .map(
        (item) =>
          `<item id="${escapeXml(item.id)}" href="${escapeXml(item.href)}" media-type="${escapeXml(item.mediaType)}"${
            item.properties ? ` properties="${escapeXml(item.properties)}"` : ""
          }/>`
      )
      .join("\n    ")}
  </manifest>
  <spine toc="ncx">
    ${spine.map((id) => `<itemref idref="${escapeXml(id)}"/>`).join("\n    ")}
  </spine>
  <guide>
    <reference type="toc" title="Contents" href="nav.xhtml"/>
    <reference type="text" title="Start Reading" href="${escapeXml(startHref)}"/>
  </guide>
</package>`
  );

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  return { buffer, warnings: st.warnings };
}

export async function generateEpub(options: EpubOptions): Promise<Buffer> {
  return (await buildEpub(options)).buffer;
}
