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

// Convert a single content block to Typst source.  Returns the Typst markup
// for that block; the caller concatenates them in order.
function convertBlock(block: Block, images: EmbeddedImage[]): string {
  if (!block) return "";

  switch (block.type) {
    case "paragraph":
      return `${escapeTypst(block.text || "")}\n\n`;

    case "heading_h1":
      return `= ${escapeTypst(block.text || "")}\n\n`;

    case "heading_h2":
      return `== ${escapeTypst(block.text || "")}\n\n`;

    case "heading_h3":
      return `=== ${escapeTypst(block.text || "")}\n\n`;

    case "quote":
      return `#quote(block: true)[${escapeTypst(block.text || "")}]\n\n`;

    case "list_ordered":
      return (block.items || []).map(item => `+ ${escapeTypst(item)}`).join("\n") + "\n\n";

    case "list_unordered":
      return (block.items || []).map(item => `- ${escapeTypst(item)}`).join("\n") + "\n\n";

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
          typstTable += `  [${escapeTypst(cell?.text || "")}],\n`;
        }
      }
      typstTable += `)\n\n`;
      return typstTable;

    case "footnote":
      return `#footnote[${escapeTypst(block.text || "")}]`;

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
      return `#align(center)[*${escapeTypst(block.text || "")}*]\n\n`;

    // --- ToC entry: dot-leader tab-stop row (#1) ---------------------------
    // Rendered as a grid with label | dotted line | page number, so the dot
    // leader and page number stay pinned right and never wrap mid-line.
    case "toc_entry": {
      const label = escapeTypst(block.text || "");
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

    // --- Practice box: bordered, tinted, with eyebrow label (#4) -----------
    // The inner blocks (ordered list, paragraphs) are rendered recursively.
    case "practice_box": {
      const label = escapeTypst(block.label || "");
      const inner = (block.blocks || [])
        .map(b => convertBlock(b, images))
        .join("");
      return `#block(
  inset: 12pt,
  stroke: 0.5pt + rgb("#8a8178"),
  fill: rgb("#f5f2ec"),
  width: 100%,
)[
  #text(size: 9pt, tracking: 0.2em, weight: "bold")[PRACTICE]
  #v(0.05in)
  #text(size: 13pt, weight: "bold")[${label}]
  #v(0.15in)
  ${inner}
]\n\n`;
    }

    // --- Epigraph: centered blockquote with attribution (#2, #5) -----------
    case "epigraph": {
      const quote = escapeTypst(block.text || "");
      const attr = block.attribution ? block.attribution.trim() : "";
      if (attr) {
        const attrEscaped = escapeTypst(attr);
        return `#align(center)[
  #block(inset: (x: 2em))[
    #text(style: "italic")[${quote}]
    #v(0.3em)
    #text(size: 0.9em)[— ${attrEscaped}]
  ]
]\n\n`;
      }
      return `#align(center)[
  #block(inset: (x: 2em))[
    #text(style: "italic")[${quote}]
  ]
]\n\n`;
    }

    // --- Copyright page: small centered text, own page (#2) ----------------
    case "copyright":
      return `#pagebreak(to: "even", weak: true)\n#v(2in)\n#align(center)[#text(size: 8.5pt)[${escapeTypst(block.text || "")}]]\n#pagebreak(to: "even", weak: true)\n\n`;

    default:
      return `${escapeTypst(block.text || "")}\n\n`;
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
const INDIC_FALLBACK_FONTS = [
  "Source Serif 4",
  "Noto Serif Devanagari",
  "Noto Serif Malayalam",
  "Noto Serif Tamil",
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

// Ordinal word -> number, for chapter eyebrow labels ("One" -> 1).
const ORDINAL_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};

// Extract the ordinal word from a chapter title like "One · The Night..." or
// "The Night the Floor Went".  Returns the ordinal label ("ONE") or "" if the
// title doesn't start with an ordinal.
function chapterEyebrow(title: string): string {
  const m = title.match(/^(\w+)\s*[·•]\s+/);
  if (m && ORDINAL_WORDS[m[1].toLowerCase()]) {
    return m[1].toUpperCase();
  }
  return "";
}

// Strip the ordinal prefix from a chapter title: "One · The Night..." -> "The Night..."
function stripOrdinal(title: string): string {
  return title.replace(/^\w+\s*[·•]\s+/, "");
}

export function generateTypstSource(options: RendererOptions): { source: string; images: EmbeddedImage[]; imageBlockCount: number } {
  const { structure, settings, templateName } = options;
  const tpl = (templateName || "classic").toLowerCase().replace(/[^a-z]/g, "") || "classic";
  const images: EmbeddedImage[] = [];
  const imageBlockCount = countImageBlocks(structure);

  let source = `#import "/src/lib/renderer/typst/templates/${tpl}.typ": project\n\n`;

  // Inject metadata and settings
  source += `#show: project.with(\n`;
  source += `  title: "${escapeTypstString(structure.title || "Untitled")}",\n`;
  source += `  author: "${escapeTypstString(structure.author || "Unknown")}",\n`;
  if (structure.subtitle) {
    source += `  subtitle: "${escapeTypstString(structure.subtitle)}",\n`;
  }
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

  source += `  trimSize: "${settings.trimSize}",\n`;
  source += `  margins: (inside: ${settings.margins.insideMm}mm, outside: ${settings.margins.outsideMm}mm, top: ${settings.margins.topMm}mm, bottom: ${settings.margins.bottomMm}mm),\n`;
  source += `  bodyFont: ${typstFontList(bodyFontName)},\n`;
  source += `  bodySize: ${settings.body.fontSizePt}pt,\n`;
  source += `  leading: ${settings.body.leadingEm}em,\n`;
  source += `  headingFont: ${typstFontList(headingFontName)},\n`;
  source += `  h1Size: ${settings.heading.h1SizePt}pt,\n`;
  source += `  h2Size: ${settings.heading.h2SizePt}pt,\n`;
  source += `  h3Size: ${settings.heading.h3SizePt}pt,\n`;
  source += `  chapterOpenRecto: ${settings.layout.chapterOpenRecto ? "true" : "false"},\n`;
  source += `  runningHeaders: ${settings.layout.runningHeaders ? "true" : "false"},\n`;
  source += `  pageNumbers: "${escapeTypstString(settings.layout.pageNumbersPosition)}",\n`;
  // Only emit non-default parameters — pass-through templates use `..args`
  // which doesn't forward named args in Typst 0.11's `.with()` calls.
  const bleedMm = settings.layout.bleedEnabled ? (settings.layout.bleedMm || 3.175) : 0;
  if (bleedMm > 0) {
    source += `  bleedMm: ${bleedMm},\n`;
  }
  if (settings.body.firstLineIndentMm !== undefined && settings.body.firstLineIndentMm !== 4.23) {
    source += `  firstLineIndentMm: ${settings.body.firstLineIndentMm},\n`;
  }
  if (settings.body.paragraphSpacingMm !== undefined && settings.body.paragraphSpacingMm !== 0) {
    source += `  paragraphSpacingMm: ${settings.body.paragraphSpacingMm},\n`;
  }
  if (settings.layout.runningHeaderFormat && settings.layout.runningHeaderFormat !== "title_author") {
    source += `  runningHeaderFormat: "${escapeTypstString(settings.layout.runningHeaderFormat)}",\n`;
  }
  if (settings.layout.orphanWidowTarget !== undefined && settings.layout.orphanWidowTarget !== 2) {
    source += `  orphanWidowTarget: ${settings.layout.orphanWidowTarget},\n`;
  }
  // Map the detected manuscript script to a Typst language code for correct
  // hyphenation and accessibility metadata.  Only emitted when non-default
  // ("en") so pass-through templates that use ..args don't see an unexpected
  // named parameter.
  const scriptToLang: Record<string, string> = {
    devanagari: "hi",
    tamil: "ta",
    malayalam: "ml",
    bengali: "bn",
    gujarati: "gu",
    kannada: "kn",
    telugu: "te",
    gurmukhi: "pa",
    odia: "or",
  };
  const textLang = scriptToLang[structure.detectedScript || ""] || "en";
  if (textLang !== "en") {
    source += `  textLang: "${textLang}",\n`;
  }
  source += `  showColophon: true,\n`;
  source += `)\n\n`;

  // --- Front Matter (#2/#3/#7): discrete typed blocks ----------------------
  // The template already renders the title page.  Here we emit the remaining
  // front-matter entries (copyright, epigraphs, note, preface, ToC) as
  // separate page sequences, each with its own heading style.
  if (structure.frontMatter && structure.frontMatter.length > 0) {
    for (const fm of structure.frontMatter) {
      // Skip "front_matter" pseudo-entries that were just a dump of the
      // title page — the template handles the title page itself.
      if (fm.type === "title_page") continue;

      // ToC entries use the toc_entry block type, which renders as a
      // dot-leader grid row — never as flowing justified prose.
      if (fm.type === "toc") {
        source += `#pagebreak(to: "odd", weak: true)\n`;
        source += `#v(1in)\n`;
        source += `#align(center)[#text(size: 20pt, weight: "bold")[Contents]]\n`;
        source += `#v(0.5in)\n`;
        for (const block of fm.blocks) {
          source += convertBlock(block, images);
        }
        source += `#pagebreak(to: "odd", weak: true)\n\n`;
        continue;
      }

      // Epigraphs: render on a fresh page but DON'T force recto.  Multiple
      // epigraphs each get their own page (they're short), but without the
      // `to: "odd"` constraint that would insert a blank even page between
      // every pair of epigraphs.  Only major sections (copyright, ToC,
      // preface, first chapter) need recto openings.
      if (fm.type === "epigraph") {
        source += `#pagebreak(weak: true)\n`;
        for (const block of fm.blocks) {
          source += convertBlock(block, images);
        }
        continue;
      }

      // Other front-matter sections (note, preface, etc.) get a centered
      // heading and start on a fresh recto page.
      if (fm.title) {
        source += `#pagebreak(to: "odd", weak: true)\n`;
        source += `#v(1in)\n`;
        source += `#align(center)[#text(size: 18pt, weight: "bold")[${escapeTypst(fm.title)}]]\n`;
        source += `#v(0.5in)\n`;
      }
      for (const block of fm.blocks) {
        source += convertBlock(block, images);
      }
      source += `#pagebreak(to: "odd", weak: true)\n\n`;
    }
  }

  // --- Chapters -----------------------------------------------------------
  if (structure.chapters && structure.chapters.length > 0) {
    for (const ch of structure.chapters) {
      // Part dividers ("Part One — The Break") are headings; the template's
      // heading show rule detects the "Part " prefix and suppresses the folio.
      // Chapter titles get an ordinal eyebrow ("ONE") above the title for
      // consistency with the ToC (#7).
      const isPart = /^Part\s/.test(ch.title);
      if (isPart) {
        source += `= ${escapeTypst(ch.title)}\n\n`;
      } else {
        const eyebrow = chapterEyebrow(ch.title);
        const cleanTitle = eyebrow ? stripOrdinal(ch.title) : ch.title;
        if (eyebrow) {
          // Emit the eyebrow as a small-caps line above the chapter heading.
          // A paragraph (not heading) so it doesn't trigger the heading
          // show rule's page break twice.
          source += `#align(center)[#text(size: 10pt, weight: "regular", tracking: 0.15em)[#smallcaps[${escapeTypst(eyebrow)}]]]\n`;
          source += `#v(0.3in)\n`;
          source += `= ${escapeTypst(cleanTitle)}\n\n`;
        } else {
          source += `= ${escapeTypst(ch.title)}\n\n`;
        }
      }

      if (ch.sections) {
        for (const sec of ch.sections) {
          if (sec.title) {
            source += `== ${escapeTypst(sec.title)}\n\n`;
          }
          for (const block of sec.blocks) {
            source += convertBlock(block, images);
          }
        }
      }
    }
  }

  // --- Back Matter --------------------------------------------------------
  if (structure.backMatter && structure.backMatter.length > 0) {
    for (const bm of structure.backMatter) {
      if (bm.title) {
        source += `= ${escapeTypst(bm.title)}\n\n`;
      }
      for (const block of bm.blocks) {
        source += convertBlock(block, images);
      }
    }
  }

  // The colophon is now rendered by the template itself (showColophon param).

  return { source, images, imageBlockCount };
}
