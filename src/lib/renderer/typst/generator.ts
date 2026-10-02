import type { BookStructureV1, Block } from "../../manuscript/types";
import type { EffectiveSettings } from "../../templates/engine";
import type { EmbeddedImage, RendererOptions } from "../types";
import { hasKnownImageMagic } from "../image-check";

export type { EmbeddedImage } from "../types";

function escapeTypst(text: string): string {
  // Strip non-printable / binary bytes before escaping. PDF and DOCX
  // extraction can occasionally leak raw binary (compressed streams, font
  // tables) into block text; if that reaches Typst it produces "unclosed
  // delimiter" / "unclosed raw text" compile errors. Keep tab, newline,
  // carriage return, and form feed (page-break marker).
  const cleaned = (typeof text === "string" ? text : String(text ?? ""))
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  // Escape Typst markup-active characters in body content
  return cleaned
    .replace(/\\/g, '\\\\')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/~/g, '\\~')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/@/g, '\\@')
    .replace(/</g, '\\<')
    .replace(/`/g, '\\`');
}

// Escape for use inside a Typst "..." string literal (template arguments)
function escapeTypstString(text: string): string {
  const safe = typeof text === "string" ? text : String(text ?? "");
  // Collapse any control or newline chars to spaces, then escape backslash and quotes
  return safe
    .replace(/[\x00-\x1f\x7f]/g, (c) => (c === "\t" ? " " : " "))
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, " ");
}

const DATA_URI_REGEX = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s;
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
};

// A contiguous run of Devanagari (plus the separators that live inside a
// phrase: spaces, dandas, punctuation).  Matched runs get wrapped in
// `#text(lang: "sa", script: "deva", font: "Noto Serif Devanagari")[…]`.
const DEVANAGARI_RUN =
  /[\u0900-\u097F]+(?:[\s,;:!?()\[\]'’“”"\-–—\u0964\u0965]*[\u0900-\u097F]+)*/g;

// Escape + enrich a text node for Typst markup context:
//  1. Devanagari spans wrapped in an explicit font/language call so the right
//     font is chosen and hyphenation/tagging use Sanskrit rules.
//  2. Non-breaking space inside "Ch. 3", "p. 12", "Fig. 4", "No. 7" etc. —
//     the space is emitted as Typst `~`, which renders as a real nbsp and
//     extracts as U+00A0 (not a breakable space).
function inlineText(text: string): string {
  const pieces: string[] = [];
  let last = 0;
  const t = text || "";
  DEVANAGARI_RUN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DEVANAGARI_RUN.exec(t)) !== null) {
    if (m.index > last) pieces.push(escapeTypst(t.slice(last, m.index)));
    pieces.push(
      `#text(lang: "sa", script: "deva", font: "Noto Serif Devanagari")[${escapeTypst(m[0])}]`
    );
    last = m.index + m[0].length;
  }
  if (last < t.length) pieces.push(escapeTypst(t.slice(last)));
  return pieces
    .join("")
    .replace(/\b(Ch|ch|p|pp|Fig|fig|No|no|Vol|vol|Sec|sec)\. (\d)/g, "$1.~$2");
}

interface RenderCtx {
  images: EmbeddedImage[];
  /** Paper height in inches — needed by practice boxes to decide breakability. */
  pageHeightIn: number;
}

// Convert a single content block to Typst source.  Returns the Typst markup
// for that block; the caller concatenates them in order.
function convertBlock(block: Block, ctx: RenderCtx): string {
  if (!block) return "";
  const images = ctx.images;

  switch (block.type) {
    case "paragraph":
      return `${inlineText(block.text || "")}\n\n`;

    // A paragraph that should not start with a first-line indent — the first
    // paragraph after a heading or a break.
    case "noindent_paragraph":
      return `#par(first-line-indent: 0pt)[${inlineText(block.text || "")}]\n\n`;

    // A level-1 heading that survived inside a chapter body was not a chapter
    // boundary — render it as a section head so it never triggers the
    // chapter-opener machinery (page break, numbering, ToC entry).
    // heading_h2/h3 are sticky via the template's keep-with-next emulation
    // (Typst 0.11 has no block(sticky:)); see subheading() in classic.typ.
    case "heading_h1":
    case "heading_h2":
      return `== ${inlineText(block.text || "")}\n\n`;

    case "heading_h3":
      return `=== ${inlineText(block.text || "")}\n\n`;

    case "quote":
      if (block.attribution) {
        return `#quote(block: true, attribution: [${inlineText(block.attribution)}])[${inlineText(block.text || "")}]\n\n`;
      }
      return `#quote(block: true)[${inlineText(block.text || "")}]\n\n`;

    case "list_ordered":
      return (block.items || []).map(item => `+ ${inlineText(item)}`).join("\n") + "\n\n";

    case "list_unordered":
      return (block.items || []).map(item => `- ${inlineText(item)}`).join("\n") + "\n\n";

    case "table":
      if (!block.rows || block.rows.length === 0) return "";
      const cols = block.rows[0].cells.length;
      if (cols === 0) return "";
      // Validate all rows have the same cell count — a mismatch crashes Typst.
      // Pad short rows with empty cells, truncate long rows.
      let typstTable = `#table(\n  columns: ${cols},\n`;
      for (const row of block.rows) {
        for (let i = 0; i < cols; i++) {
          const cell = row.cells[i];
          typstTable += `  [${inlineText(cell?.text || "")}],\n`;
        }
      }
      typstTable += `)\n\n`;
      return typstTable;

    case "footnote":
      return `#footnote[${inlineText(block.text || "")}]`;

    case "image": {
      const src = block.src || "";
      const dataUri = src.match(DATA_URI_REGEX);
      if (dataUri) {
        const ext = MIME_TO_EXT[dataUri[1].toLowerCase()] || "png";
        const fileName = `images/img-${images.length}.${ext}`;
        try {
          const buffer = Buffer.from(dataUri[2], "base64");
          // Undecodable bytes would crash the Typst compile — render a
          // placeholder box instead and let the image check flag it.
          if (buffer.length >= 12 && hasKnownImageMagic(buffer)) {
            images.push({ fileName, buffer });
            const img = `#image("${fileName}", width: 80%)`;
            const alt = (block.alt || "").trim();
            return alt
              ? `#align(center)[#figure(${img}, caption: [${escapeTypst(alt)}])]\n\n`
              : `#align(center)[${img}]\n\n`;
          }
        } catch {
          // fall through to placeholder on undecodable data
        }
      }
      return `#align(center)[#rect(width: 80%, height: 2in)[Image: ${escapeTypst(block.alt || "Image")}]]\n\n`;
    }

    case "caption":
      return `#align(center)[*${inlineText(block.text || "")}*]\n\n`;

    // --- ToC entry: dot-leader tab-stop row ---------------------------------
    // Rendered as a grid with label | dotted line | page number, so the dot
    // leader and page number stay pinned right and never wrap mid-line.
    case "toc_entry": {
      const label = inlineText(block.text || "");
      const page = block.page ?? "";
      return `#block(width: 100%)[#grid(
  columns: (auto, 1fr, auto),
  column-gutter: 0.3em,
  align: (left, center, right),
  [${label}],
  line(length: 100%, stroke: (paint: rgb("#8a8178"), thickness: 0.4pt, dash: "dotted")),
  [#text[${page}]],
)]\n`;
    }

    // --- Practice box: unbreakable bordered block; tall boxes are split by
    // the template into chunks with a repeated "PRACTICE (CONTINUED)" label.
    // The metadata marker feeds the "Practices" list in the ToC.
    case "practice_box": {
      const label = escapeTypstString(block.label || "");
      const items = (block.blocks || []).map((b) => `[${convertBlock(b, ctx).trim()}]`);
      return `#metadata((title: "${label}")) <racana-practice>
#practice-box("${label}", ${ctx.pageHeightIn}in,
${items.join(",\n")}
)\n\n`;
    }

    // --- Epigraph: centered italic quote, attribution in small caps ----------
    case "epigraph": {
      const quote = inlineText(block.text || "");
      const attr = block.attribution ? block.attribution.trim() : "";
      if (attr) {
        return `#align(center)[
  #block(inset: (x: 2em))[
    #text(style: "italic")[${quote}]
    #v(0.35em)
    #smallcaps[#text(size: 0.9em)[${inlineText(attr)}]]
  ]
]\n\n`;
      }
      return `#align(center)[
  #block(inset: (x: 2em))[
    #text(style: "italic")[${quote}]
  ]
]\n\n`;
    }

    // --- Copyright page: small centered text, own page -----------------------
    case "copyright":
      return `#pagebreak(to: "even", weak: true)\n#v(2in)\n#align(center)[#text(size: 8.5pt)[${escapeTypst(block.text || "")}]]\n#pagebreak(to: "even", weak: true)\n\n`;

    default:
      return `${inlineText(block.text || "")}\n\n`;
  }
}

// Indic fonts are always appended to the fallback chain — Typst resolves
// fonts per glyph, so Latin text keeps the chosen family while Devanagari /
// Malayalam / Tamil characters render correctly with zero extra work for the
// author. This is what makes mixed-script Indian manuscripts just work.
// Source Serif 4 is appended as a Latin fallback to cover glyphs that the
// primary font may lack (e.g. ∞ U+221E, which Libre Baskerville doesn't
// cover) — without it, Typst falls back to system fonts like LinLibertine
// (#11).
// Fallback order after the primary body font — spec: ("EB Garamond",
// "Noto Serif Devanagari", "Noto Serif") with Indic siblings for other
// scripts and Source Serif 4 as the last Latin fallback.
const INDIC_FALLBACK_FONTS = [
  "Noto Serif Devanagari",
  "Noto Serif Malayalam",
  "Noto Serif Tamil",
  "Noto Serif",
  "Source Serif 4",
];

function typstFontList(primary: string): string {
  const fonts = [primary, ...INDIC_FALLBACK_FONTS];
  return `(${fonts.map((f) => `"${escapeTypstString(f)}"`).join(", ")})`;
}

function countImageBlocks(structure: BookStructureV1): number {
  let n = 0;
  const walk = (blocks?: Block[]) =>
    blocks?.forEach((b) => {
      if (b.type === "image") n++;
      if (b.blocks) walk(b.blocks);
    });
  structure.frontMatter?.forEach((f) => walk(f.blocks));
  structure.chapters?.forEach((c) => c.sections?.forEach((s) => walk(s.blocks)));
  structure.backMatter?.forEach((b) => walk(b.blocks));
  return n;
}


// Ordinal word -> number, for chapter titles like "One · The Night".
const ORDINAL_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

function fromRoman(s: string): number {
  const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let val = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]] ?? 0;
    const next = i + 1 < s.length ? map[s[i + 1]] ?? 0 : 0;
    if (cur < next) { val += next - cur; i++; } else { val += cur; }
  }
  return val;
}

function parseOrdinal(s: string): number {
  const t = s.trim();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (/^[ivxlcdm]+$/i.test(t)) return fromRoman(t.toUpperCase());
  return ORDINAL_WORDS[t.toLowerCase()] || 0;
}

// Headings that are structural units in their own right — never given a
// "Chapter N" eyebrow.
const UNNUMBERED_HEADING = /^(book|part|section|prologue|epilogue|introduction|preface|foreword|afterword|appendix|conclusion|acknowledg|interlude|postscript|coda|notes?$|glossary|index$|bibliography|about the author)/i;

export interface ChapterOpener {
  kind: "chapter" | "part" | "matter";
  number: number;
  label: string;
  title: string;
  /** Part openers only: italic line under the part title. */
  subtitle?: string;
}

// Decide how a chapter heading is presented: eyebrow label + number + title.
//   "Chapter 3"              -> number 3, title ""         (opener shows "Chapter Three")
//   "Chapter 3: The Night"   -> number 3, title "The Night"
//   "3. The Night" / "One · The Night" -> number + title
//   "Prologue"               -> number 0, title "Prologue"
//   "Part One — The Break"   -> part divider
//   "The Beginning"          -> sequential number, title "The Beginning"
export function resolveChapterOpener(rawTitle: string, sequence: number): ChapterOpener {
  const title = rawTitle.trim();
  if (/^part\b/i.test(title)) return { kind: "part", number: 0, label: "", title };

  const explicit = title.match(/^chapter\s+([a-z0-9]+)(?![a-z])[\s:.\-—–·]*(.*)$/i);
  if (explicit) {
    const n = parseOrdinal(explicit[1]) || sequence;
    return { kind: "chapter", number: n, label: "", title: explicit[2].trim() };
  }
  const numbered = title.match(/^(\d{1,3}|[ivxlcdm]{1,6}|[a-z]+)\s*[.:·•—–-]\s+(.+)$/i);
  if (numbered) {
    const n = parseOrdinal(numbered[1]);
    if (n > 0) return { kind: "chapter", number: n, label: "", title: numbered[2].trim() };
  }
  if (UNNUMBERED_HEADING.test(title)) return { kind: "chapter", number: 0, label: "", title };
  return { kind: "chapter", number: sequence, label: "", title };
}

function openerCall(o: ChapterOpener, recto: boolean, first = false): string {
  // Subtitle is passed as markup content (not a string) so `smartquote`
  // converts its apostrophes/quotes properly.
  const sub = o.subtitle ? `, subtitle: [${inlineText(o.subtitle)}]` : "";
  return `#chapter(kind: "${o.kind}", number: ${o.number}, label: "${escapeTypstString(o.label)}"${sub}, recto: ${recto}, first: ${first})[${escapeTypst(o.title)}]\n\n`;
}

function normalizeLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

// Choose the words set in small caps at a chapter opening — roughly the first
// typographic line (3–5 words, max 34 chars).  Returns "" when small caps
// don't apply (non-Latin scripts, quote-opened lines, very short paragraphs).
function smallcapsLead(text: string): string {
  if (!/^[\u0041-\u005A\u0061-\u007A\u00C0-\u024F"'\u201C\u2018(]/.test(text)) return "";
  const words = text.split(/\s+/);
  let lead = "";
  for (const w of words) {
    const cand = lead ? `${lead} ${w}` : w;
    if (cand.length > 34 || (lead && lead.split(/\s+/).length >= 5)) break;
    lead = cand;
  }
  // Smallcaps need at least one real letter, and must leave real text behind.
  if (!/[A-Za-z]/.test(lead) || text.length - lead.length < 10) return "";
  return lead;
}

// Which running-head formats the template understands.  Older JSON values
// ("book-title|chapter-title") are mapped onto the closest real behaviour.
function resolveRunningHeaderFormat(fmt: string | undefined): string {
  switch ((fmt || "").toLowerCase()) {
    case "none": return "none";
    case "title_author":
    case "author-name|chapter-title":
    case "author-name|book-title": return "title_author";
    case "chapter_only":
    case "chapter-title": return "chapter_only";
    default: return "title_chapter";
  }
}

// One canonical brand domain — BRAND_DOMAIN env wins, racana.pro is the
// default.  Used in the colophon, copyright line and preview watermark.
function brandDomain(): string {
  return (process.env.BRAND_DOMAIN || "racana.pro").trim() || "racana.pro";
}

const TRIM_HEIGHT_IN: Record<string, number> = {
  "5x8": 8,
  "5.5x8.5": 8.5,
  "6x9": 9,
  "8.5x11": 11,
};

export function generateTypstSource(options: RendererOptions): { source: string; images: EmbeddedImage[]; imageBlockCount: number } {
  const { structure, settings, templateName } = options;
  const tpl = (templateName || "classic").toLowerCase().replace(/[^a-z]/g, "") || "classic";
  const images: EmbeddedImage[] = [];
  const imageBlockCount = countImageBlocks(structure);
  const chapterStyle = tpl === "modern" || tpl === "academic" ? "modern" : "classic";
  const ctx: RenderCtx = {
    images,
    pageHeightIn: TRIM_HEIGHT_IN[settings.trimSize] || 9,
  };

  const title = (structure.title || "").trim() || "Untitled";
  const author = (structure.author || "").trim();
  const subtitle = (structure.subtitle || "").trim();

  let source = `#import "/src/lib/renderer/typst/templates/${tpl}.typ": project, chapter, begin-body, begin-front-text, begin-display-page, book-toc, practice-box\n\n`;

  // Select fonts appropriate for the detected script.  The template's
  // default font may not support the manuscript's script (e.g. EB Garamond
  // can't render Malayalam glyphs).  We override with a script-appropriate
  // Noto family when needed; the font must also be in `fontsEmbed`.
  const scriptToFont: Record<string, { body: string; heading: string }> = {
    devanagari: { body: "Noto Serif Devanagari", heading: "Noto Serif Devanagari" },
    malayalam: { body: "Noto Serif Malayalam", heading: "Noto Serif Malayalam" },
    tamil: { body: "Noto Serif Tamil", heading: "Noto Serif Tamil" },
  };
  const scriptFont = scriptToFont[structure.detectedScript || ""];
  const bodyFontName = scriptFont?.body || settings.body.fontFamily || "EB Garamond";
  const headingFontName = scriptFont?.heading || settings.heading.fontFamily || "EB Garamond";

  // The manuscript's own copyright page (if any) replaces the generated one.
  const copyrightEntry = structure.frontMatter?.find((f) => f.type === "copyright");
  const copyrightText = copyrightEntry
    ? copyrightEntry.blocks.map((b) => (b.text || "").trim()).filter(Boolean).join("\n")
    : "";

  source += `#show: project.with(\n`;
  source += `  title: "${escapeTypstString(title)}",\n`;
  source += `  author: "${escapeTypstString(author)}",\n`;
  if (subtitle) source += `  subtitle: "${escapeTypstString(subtitle)}",\n`;
  source += `  trimSize: "${settings.trimSize}",\n`;
  source += `  margins: (inside: ${settings.margins.insideMm}mm, outside: ${settings.margins.outsideMm}mm, top: ${settings.margins.topMm}mm, bottom: ${settings.margins.bottomMm}mm),\n`;
  source += `  bodyFont: ${typstFontList(bodyFontName)},\n`;
  source += `  bodySize: ${settings.body.fontSizePt}pt,\n`;
  source += `  leading: ${settings.body.leadingEm}em,\n`;
  source += `  headingFont: ${typstFontList(headingFontName)},\n`;
  source += `  h1Size: ${settings.heading.h1SizePt}pt,\n`;
  source += `  h2Size: ${settings.heading.h2SizePt}pt,\n`;
  source += `  h3Size: ${settings.heading.h3SizePt}pt,\n`;
  source += `  headingSpaceBeforeMm: ${settings.heading.spacingBeforeMm ?? 8},\n`;
  source += `  headingSpaceAfterMm: ${settings.heading.spacingAfterMm ?? 3},\n`;
  source += `  chapterOpenRecto: ${settings.layout.chapterOpenRecto ? "true" : "false"},\n`;
  source += `  runningHeaders: ${settings.layout.runningHeaders ? "true" : "false"},\n`;
  source += `  runningHeaderFormat: "${resolveRunningHeaderFormat(settings.layout.runningHeaderFormat)}",\n`;
  source += `  pageNumbers: "${escapeTypstString(settings.layout.pageNumbersPosition)}",\n`;
  source += `  firstLineIndentMm: ${settings.body.firstLineIndentMm ?? 4.23},\n`;
  source += `  paragraphSpacingMm: ${settings.body.paragraphSpacingMm ?? 0},\n`;
  source += `  quoteIndentLeftMm: ${settings.quote.indentLeftMm ?? 12},\n`;
  source += `  quoteIndentRightMm: ${settings.quote.indentRightMm ?? 12},\n`;
  source += `  quoteFontSizeEm: ${settings.quote.fontSizeAdjustEm ?? 0.95},\n`;
  source += `  quoteItalic: ${settings.quote.italic === false ? "false" : "true"},\n`;
  source += `  chapterStyle: "${chapterStyle}",\n`;
  const bleedMm = settings.layout.bleedEnabled ? (settings.layout.bleedMm || 3.175) : 0;
  if (bleedMm > 0) source += `  bleedMm: ${bleedMm},\n`;
  // The author's own copyright text is passed as markup content (not a
  // string) so `smartquote` converts its quotes/apostrophes properly.
  if (copyrightText) {
    const copyrightMarkup = copyrightText
      .split("\n")
      .map((l) => (l.trim() === "" ? "#v(0.55em) #linebreak()" : `${escapeTypst(l)} #linebreak()`))
      .join("\n");
    source += `  copyright: [${copyrightMarkup}],\n`;
  }
  source += `  year: "${new Date().getFullYear()}",\n`;
  // Map the detected manuscript script to a Typst language code for correct
  // hyphenation and accessibility metadata.
  const scriptToLang: Record<string, string> = {
    devanagari: "hi", tamil: "ta", malayalam: "ml", bengali: "bn", gujarati: "gu",
    kannada: "kn", telugu: "te", gurmukhi: "pa", odia: "or",
  };
  const textLang = scriptToLang[structure.detectedScript || ""] || "en";
  if (textLang !== "en") source += `  textLang: "${textLang}",\n`;
  source += `  showColophon: ${options.includeColophon === false ? "false" : "true"},\n`;
  source += `  brandDomain: "${escapeTypstString(brandDomain())}",\n`;
  source += `  previewWatermark: ${options.preview ? "true" : "false"},\n`;
  source += `)\n\n`;

  // The first paragraph of a chapter: no first-line indent, and its opening
  // words (~first line) are set in small caps — the classic book-opener cue.
  const chapterFirstParagraph = (block: Block): string => {
    const text = (block.text || "").trim();
    const lead = smallcapsLead(text);
    if (!lead) return `#par(first-line-indent: 0pt)[${inlineText(text)}]\n\n`;
    const rest = text.slice(lead.length);
    return `#par(first-line-indent: 0pt)[#smallcaps[${escapeTypst(lead)}]${inlineText(rest)}]\n\n`;
  };

  // Render a block list; paragraphs that follow a heading lose their
  // first-line indent ("no indent after headings or breaks").
  const renderBlocks = (blocks: Block[]) => {
    let prevWasHeading = false;
    return blocks
      .map((b) => {
        if (b.type === "paragraph" && prevWasHeading) {
          prevWasHeading = false;
          return convertBlock({ ...b, type: "noindent_paragraph" }, ctx);
        }
        prevWasHeading = b.type === "heading_h1" || b.type === "heading_h2" || b.type === "heading_h3";
        return convertBlock(b, ctx);
      })
      .join("");
  };

  const sectionHeading = (text: string, size = 18) =>
    chapterStyle === "modern"
      ? `#text(size: ${size}pt, weight: "bold")[${escapeTypst(text)}]\n#v(0.4in)\n`
      : `#align(center)[#text(size: ${size}pt)[${escapeTypst(text)}]]\n#v(0.4in)\n`;

  // --- Front matter -------------------------------------------------------
  // The template renders half-title, title and copyright pages itself.  Here
  // we emit the manuscript's remaining front matter in conventional order:
  // dedication / opening text and epigraphs (display pages, no folio), then
  // the generated table of contents, then prose sections (preface, foreword,
  // note) with roman folios.
  const chapters = structure.chapters || [];
  // A ToC is worthwhile when there's more than one structural entry —
  // part rows render as group headings even when a book has no chapters.
  const wantToc = chapters.length >= 2;
  const metaLines = new Set([title, subtitle, author].filter(Boolean).map(normalizeLine));

  const displayEntries: string[] = [];
  const textEntries: string[] = [];
  // The first numbered front-matter page gets folio "i" — roman folios start
  // there, not at the half-title.  Display pages (epigraphs, dedication)
  // carry no folio and don't consume it.
  let romanStarted = false;
  const frontTextBegin = () => {
    const reset = !romanStarted;
    romanStarted = true;
    return `#begin-front-text(reset: ${reset})`;
  };

  // Epigraphs grouped on a single display page (the conventional treatment
  // when there are a handful — e.g. this fixture's three opening quotes).
  let pendingEpigraphs: Block[] = [];
  const flushEpigraphs = () => {
    if (pendingEpigraphs.length === 0) return;
    const inner = pendingEpigraphs.map((b) => convertBlock(b, ctx)).join("#v(0.5in)\n");
    displayEntries.push(`#begin-display-page()\n#v(1.6in)\n${inner}\n`);
    pendingEpigraphs = [];
  };

  for (const fm of structure.frontMatter || []) {
    if (fm.type === "copyright" || fm.type === "toc") continue; // handled by template / regenerated

    if (fm.type === "title_page") {
      flushEpigraphs();
      // Everything on the author's title page that isn't the title, subtitle
      // or byline is real text (a dedication, an invocation, an opening
      // note) — keep it as a display page instead of dropping it.
      const rest = fm.blocks.filter((b) => {
        const t = normalizeLine(b.text || "");
        if (!t) return b.type === "image";
        if (metaLines.has(t)) return false;
        if (/^(by|written by)\s+/i.test(t) && author && t.endsWith(normalizeLine(author))) return false;
        return true;
      });
      if (rest.length === 0) continue;
      const words = rest.reduce((n, b) => n + (b.text || "").split(/\s+/).filter(Boolean).length, 0);
      if (words <= 120) {
        displayEntries.push(
          `#begin-display-page()\n#v(2.2in)\n#align(center)[#block(width: 80%)[#set par(justify: false, first-line-indent: 0pt)\n#set text(style: "italic")\n${rest.map((b) => convertBlock({ ...b, type: b.type === "paragraph" ? "paragraph" : b.type }, ctx)).join("")}]]\n\n`
        );
      } else {
        textEntries.push(`${frontTextBegin()}\n#v(1in)\n${renderBlocks(rest)}\n`);
      }
      continue;
    }

    if (fm.type === "epigraph") {
      // Accumulate — a run of epigraphs shares one display page.
      pendingEpigraphs.push(...fm.blocks);
      continue;
    }
    if (fm.type === "dedication") {
      flushEpigraphs();
      displayEntries.push(`#begin-display-page()\n#v(2.2in)\n${renderBlocks(fm.blocks)}\n`);
      continue;
    }

    flushEpigraphs();
    let entry = `${frontTextBegin()}\n#v(1in)\n`;
    if (fm.title) entry += sectionHeading(fm.title);
    entry += renderBlocks(fm.blocks) + "\n";
    textEntries.push(entry);
  }
  flushEpigraphs();

  source += displayEntries.join("");
  if (wantToc) {
    // The ToC is the first numbered front-matter page (roman i) — placed
    // after the epigraph display pages and before the Note / Preface, and
    // it opens on a recto.  "Practices" gets its own list under the chapters.
    source += `#book-toc(reset: ${!romanStarted}, headingFont: ${typstFontList(headingFontName)}, bodyFont: ${typstFontList(bodyFontName)}, style: "${chapterStyle}", h1Size: ${settings.heading.h1SizePt}pt)\n\n`;
    romanStarted = true;
  }
  source += textEntries.join("");

  // --- Chapters -----------------------------------------------------------
  if (chapters.length > 0) {
    source += `#begin-body()\n\n`;
    let sequence = 0;
    chapters.forEach((ch, idx) => {
      // Structured entries carry their own kind/label/subtitle; entries from
      // older stored structures fall back to title sniffing.
      const opener: ChapterOpener = ch.kind
        ? {
            kind: ch.kind === "matter" ? "matter" : ch.kind,
            number: ch.number || 0,
            label: ch.label || "",
            title: ch.title || "",
            subtitle: ch.subtitle,
          }
        : resolveChapterOpener(ch.title || "", sequence + 1);
      if (opener.kind === "chapter" && opener.number > 0) sequence = Math.max(sequence + 1, opener.number);
      source += openerCall(opener, settings.layout.chapterOpenRecto, idx === 0);
      let firstParaPending = opener.kind === "chapter";
      for (const sec of ch.sections || []) {
        if (sec.title) {
          const marks = "=".repeat(Math.max(2, Math.min(3, sec.level ?? 2)));
          source += `${marks} ${escapeTypst(sec.title)}\n\n`;
        }
        let prevWasHeading = !!sec.title;
        for (const b of sec.blocks || []) {
          if (b.type === "paragraph" && firstParaPending) {
            source += chapterFirstParagraph(b);
            firstParaPending = false;
            prevWasHeading = false;
            continue;
          }
          if (b.type === "paragraph" && prevWasHeading) {
            source += convertBlock({ ...b, type: "noindent_paragraph" }, ctx);
            prevWasHeading = false;
            continue;
          }
          prevWasHeading =
            b.type === "heading_h1" || b.type === "heading_h2" || b.type === "heading_h3";
          source += convertBlock(b, ctx);
        }
      }
    });
  }

  // --- Back matter --------------------------------------------------------
  for (const bm of structure.backMatter || []) {
    source += openerCall({ kind: "matter", number: 0, label: "", title: bm.title || "" }, settings.layout.chapterOpenRecto);
    source += renderBlocks(bm.blocks);
  }

  return { source, images, imageBlockCount };
}
