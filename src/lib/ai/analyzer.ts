import type {
  Block,
  BookStructureV1,
  WarningItem,
  FrontMatterEntry,
  ChapterEntry,
  ChapterSection,
  BackMatterEntry,
} from "../manuscript/types";
import { parseDocx } from "../manuscript/docx-parser";
import { parsePdf } from "../manuscript/pdf-parser";
import { detectScript } from "../manuscript/script";

type BookType = BookStructureV1["detectedBookType"];

function countWords(s: string): number {
  if (!s) return 0;
  const t = s;
  const devanagari = t.match(/[\u0900-\u097F]+/g);
  const devaCount = devanagari
    ? devanagari.reduce((n, seg) => n + Math.ceil(seg.length / 5), 0)
    : 0;
  const latin = t.replace(/[\u0900-\u097F]+/g, " ").match(/\S+/g);
  return (latin ? latin.length : 0) + devaCount;
}

function countBlockWords(block: Block): number {
  let total = 0;
  if (block.text) total += countWords(block.text);
  if (block.items) {
    for (const it of block.items) total += countWords(it);
  }
  if (block.rows) {
    for (const r of block.rows) {
      for (const c of r.cells) total += countWords(c.text);
    }
  }
  return total;
}

function countBlocksWords(blocks: Block[]): number {
  return blocks.reduce((sum, b) => sum + countBlockWords(b), 0);
}

interface ChapterHeadingMatch {
  blockIndex: number;
  chapterNumber: number;
  rawTitle: string;
  headingType: "heading_h1" | "heading_h2" | "heading_h3" | "paragraph";
  isBookLevel?: boolean;
  /** "chapter" | "part" | "backmatter" — drives segmentation and openers. */
  kind?: "chapter" | "part" | "backmatter";
  /** The marker line itself ("CHAPTER SEVEN", "PART ONE") when separate. */
  marker?: string;
  /** True when the marker carries no title and the next block supplies it. */
  takeTitleFromNext?: boolean;
}

// Ordinal words up to forty — DOCX chapter markers routinely spell the number
// out ("CHAPTER TWELVE"), which the old roman/arabic regex could not see.
const ORDINAL_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, "twenty-one": 21, "twenty-two": 22, "twenty-three": 23,
  "twenty-four": 24, "twenty-five": 25, "twenty-six": 26, "twenty-seven": 27,
  "twenty-eight": 28, "twenty-nine": 29, thirty: 30, "thirty-one": 31,
  "thirty-two": 32, "thirty-three": 33, "thirty-four": 34, "thirty-five": 35,
  "thirty-six": 36, "thirty-seven": 37, "thirty-eight": 38, "thirty-nine": 39,
  forty: 40,
};

function parseOrdinal(s: string): number {
  const t = s.trim().toLowerCase();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  if (/^[ivxlcdm]+$/.test(t)) return fromRoman(t.toUpperCase());
  return ORDINAL_WORDS[t] || 0;
}

// Back-matter section names — each becomes its own BackMatterEntry with its
// own verbatim title (never another section's label).
const BACK_MATTER_TITLE =
  /^(endnotes?|notes on .+|notes|about the author|about this book|about the book|acknowledge?ments?|glossary|bibliography|selected bibliography|references|works cited|further reading|appendix\b.*|afterword|epilogue|index|also by .*)$/i;

// "PART ONE — The Break" / bare "PART ONE" / "Part 3".  For plain paragraphs
// (unstyled markers), a following title is only trusted when a real separator
// is present, so prose like "Part one of this book describes…" stays body text.
function matchPartHeading(block: Block, t: string): ChapterHeadingMatch | null {
  const isHeading = block.type.startsWith("heading");
  const m = t.match(/^part\s+([a-z0-9]+)(?![a-zA-Z])([\s]*[:.\-—–·][\s]*|[\s]+)?([^\n]*)$/i);
  if (!m) return null;
  const rest = (m[3] || "").trim();
  const sep = (m[2] || "").trim();
  if (!isHeading) {
    if (t.length > 90) return null;
    if (rest && !sep) return null;
  }
  if (rest && /^[a-z]/.test(rest) && !sep) return null;
  return {
    blockIndex: -1,
    chapterNumber: 0,
    rawTitle: rest,
    marker: `PART ${m[1].toUpperCase()}`,
    headingType: block.type as ChapterHeadingMatch["headingType"],
    kind: "part",
    takeTitleFromNext: !rest,
  };
}

function matchChapterHeading(block: Block): ChapterHeadingMatch | null {
  const text = block.text || "";
  const t = text.trim();

  if (
    block.type !== "heading_h1" &&
    block.type !== "heading_h2" &&
    block.type !== "heading_h3" &&
    block.type !== "paragraph"
  ) {
    return null;
  }

  // Level-0 part dividers must be checked before chapters: a "PART" heading
  // is never a chapter boundary even though some matchers below could claim it.
  const part = matchPartHeading(block, t);
  if (part) return part;

  // Back-matter heads (Endnotes, About the Author, …) become boundaries only
  // when they are real headings or standalone short title lines — a sentence
  // mentioning "the endnotes" inside body text must never split a chapter.
  if (
    BACK_MATTER_TITLE.test(t) &&
    (block.type.startsWith("heading") || (block.type === "paragraph" && t.length < 70 && !/[.!?…]["'’”)]?$/.test(t)))
  ) {
    return {
      blockIndex: -1,
      chapterNumber: 0,
      rawTitle: t,
      headingType: block.type as ChapterHeadingMatch["headingType"],
      kind: "backmatter",
    };
  }

  // (?![a-zA-Z]) prevents "chapter is…"/"book in…" — and word ordinals are
  // accepted ("CHAPTER TWELVE") since the class below allows any letter.
  const chapterRegex = /^chapter\s+([a-z0-9]+)(?![a-zA-Z])[\s]*([:.\-—–·]*[\s]*)([^\n]*)$/i;
  const chapterMatch = t.match(chapterRegex);
  if (chapterMatch) {
    const num = parseOrdinal(chapterMatch[1]) || parseRomanOrArabic(chapterMatch[1]);
    const rest = (chapterMatch[3] || "").trim();
    const sep = (chapterMatch[2] || "").trim();
    const isHeading = block.type.startsWith("heading");
    // Bare marker lines ("CHAPTER TEN") take their title from the next block.
    if (!rest) {
      // For paragraphs, a bare marker is only a boundary when it truly stands
      // alone — "Chapter one I remember" style prose stays body text.
      if (!isHeading && !/^\s*chapter\s+[a-z0-9]+\s*$/i.test(t)) return null;
      return {
        blockIndex: -1,
        chapterNumber: num,
        rawTitle: "",
        marker: `CHAPTER ${chapterMatch[1].toUpperCase()}`,
        headingType: block.type as ChapterHeadingMatch["headingType"],
        kind: "chapter",
        takeTitleFromNext: true,
      };
    }
    // "Chapter 3 The Night" without a separator is accepted on headings but
    // treated as prose on paragraphs (guards "Chapter 3 of the report…").
    if (!isHeading && !sep) return null;
    return {
      blockIndex: -1,
      chapterNumber: num,
      rawTitle: rest || `Chapter ${chapterMatch[1].toUpperCase()}`,
      marker: `CHAPTER ${chapterMatch[1].toUpperCase()}`,
      headingType: block.type as ChapterHeadingMatch["headingType"],
      kind: "chapter",
    };
  }

  const bookRegex = /^book\s+([ivxlcdm0-9]+)(?![a-zA-Z])[\s:.\-—–]*([^\n]*)$/i;
  const bookMatch = t.match(bookRegex);
  if (bookMatch) {
    const num = parseRomanOrArabic(bookMatch[1]);
    const rest = (bookMatch[2] || "").trim();
    const title = rest || `Book ${bookMatch[1].toUpperCase()}`;
    return {
      blockIndex: -1,
      chapterNumber: num,
      rawTitle: title,
      headingType: block.type as ChapterHeadingMatch["headingType"],
      isBookLevel: true,
      kind: "part",
      takeTitleFromNext: !rest,
    };
  }

  if (
    block.type === "heading_h1" ||
    block.type === "heading_h2" ||
    block.type === "heading_h3"
  ) {
    const numbered = t.match(/^(\d+(?:\.\d+)?)\s*[\s:.\-—–]\s*(.+)$/);
    if (numbered) {
      const num = parseInt(numbered[1], 10);
      if (!isNaN(num) && num < 200) {
        return {
          blockIndex: -1,
          chapterNumber: num,
          rawTitle: numbered[2].trim() || t,
          headingType: block.type as ChapterHeadingMatch["headingType"],
        };
      }
    }
  }

  return null;
}

function parseRomanOrArabic(s: string): number {
  const arabic = parseInt(s, 10);
  if (!isNaN(arabic)) return arabic;
  return fromRoman(s.toUpperCase());
}

function fromRoman(s: string): number {
  const map: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  let val = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = map[s[i]] ?? 0;
    const next = i + 1 < s.length ? map[s[i + 1]] ?? 0 : 0;
    if (cur < next) {
      val += next - cur;
      i++;
    } else {
      val += cur;
    }
  }
  return val || 1;
}

function findChapterBoundaries(blocks: Block[]): ChapterHeadingMatch[] {
  const matches: ChapterHeadingMatch[] = [];
  let inToc = false;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const t = (b.text || "").trim();
    // Track the manuscript's own Contents region — its entry lines
    // ("PART ONE · THE BREAK  12") must never become structural boundaries.
    if (/^(table of contents|contents)$/i.test(t)) {
      inToc = true;
    } else if (b.type.startsWith("heading")) {
      inToc = false;
    }
    if (inToc && !b.type.startsWith("heading") && /(\d\s*$|·|\.{3,}|…)/.test(t)) continue;
    const m = matchChapterHeading(b);
    if (m) {
      // A plain-paragraph marker that ends in a bare number is almost always
      // a ToC row with a page number ("CHAPTER TWO · Title  34"), not a
      // boundary.  Real markers on real headings keep the rule lenient.
      if (!b.type.startsWith("heading") && /\d\s*$/.test(t) && /[A-Za-z\u0900-\u097F]\d+$/.test(t.replace(/\s+/g, " "))) {
        continue;
      }
      m.blockIndex = i;
      matches.push(m);
    }
  }

  // Back-matter boundaries only apply once the body has started — an
  // "Acknowledgements" in the front matter is a front-matter section, not
  // the end of the book.
  const firstBodyIdx = matches.findIndex((m) => m.kind !== "backmatter");
  const filtered = matches.filter(
    (m, idx) => m.kind !== "backmatter" || (firstBodyIdx >= 0 && idx > firstBodyIdx)
  );

  let numCounter = 0;
  let bookCounter = 0;
  for (const m of filtered) {
    if (m.kind === "backmatter" || m.kind === "part") {
      // Part/back-matter markers don't consume chapter numbers.
      if (m.isBookLevel) {
        bookCounter++;
        m.chapterNumber = m.chapterNumber || bookCounter;
      }
      continue;
    }
    if (!m.chapterNumber || m.chapterNumber <= 0 || m.chapterNumber > filtered.length + 50) {
      numCounter++;
      m.chapterNumber = numCounter;
    } else if (m.chapterNumber > 0) {
      numCounter = Math.max(numCounter, m.chapterNumber);
    }
  }
  return filtered;
}

function detectSectionHeading(block: Block): { title: string; level: number } | null {
  if (block.type === "heading_h2" || block.type === "heading_h3") {
    return { title: block.text || "", level: block.level ?? (block.type === "heading_h2" ? 2 : 3) };
  }
  if (block.type === "paragraph" && block.text) {
    const t = block.text.trim();
    const numbered = t.match(/^(\d+(?:\.\d+){1,2})\s+[A-Z\u0900-\u097F]/);
    if (numbered) {
      const parts = numbered[1].split(".").length;
      return { title: t, level: Math.min(parts, 3) };
    }
  }
  return null;
}

interface SectionAccumulator {
  title: string;
  level?: number;
  blocks: Block[];
}

function splitIntoSections(blocks: Block[]): ChapterSection[] {
  const sections: SectionAccumulator[] = [];
  let current: SectionAccumulator | null = null;

  const flushCurrent = () => {
    if (current) {
      sections.push(current);
      current = null;
    }
  };

  for (const b of blocks) {
    const sectionInfo = detectSectionHeading(b);
    if (sectionInfo && sectionInfo.level >= 2) {
      flushCurrent();
      current = { title: sectionInfo.title, level: sectionInfo.level, blocks: [] };
      continue;
    }
    if (!current) {
      current = { title: "", level: 2, blocks: [] };
    }
    current.blocks.push(b);
  }
  flushCurrent();

  return sections.map((s) => ({
    title: s.title,
    level: s.level ?? 2,
    blocks: s.blocks,
  }));
}

function detectFrontMatterType(blocks: Block[]): string {
  const text = blocks
    .map((b) => b.text || "")
    .join("\n")
    .toLowerCase();
  if (text.includes("foreword")) return "foreword";
  if (text.includes("preface")) return "preface";
  if (text.includes("acknowledg")) return "acknowledgments";
  if (text.includes("dedication") || text.length < 500) return "dedication";
  if (text.includes("table of contents") || text.includes("contents")) return "toc";
  if (text.includes("introduction") || text.includes("prologue")) return "introduction";
  return "front_matter";
}

function detectBackMatterType(blocks: Block[]): string {
  const text = blocks
    .map((b) => b.text || "")
    .join("\n")
    .toLowerCase();
  // Order matters: "About the Author" contains none of these words but must
  // never be labelled "endnotes", and "Notes on Sources" is its own section.
  if (text.includes("about the author")) return "about_author";
  if (text.includes("acknowledg")) return "acknowledgments";
  if (text.includes("bibliography") || text.includes("references") || text.includes("works cited")) return "bibliography";
  if (text.includes("notes on") || text.includes("sources") || text.includes("further reading")) return "sources";
  if (text.includes("appendix")) return "appendix";
  if (text.includes("glossary")) return "glossary";
  if (text.includes("index")) return "index";
  if (text.includes("afterword") || text.includes("epilogue")) return "afterword";
  if (text.includes("endnotes") || text.includes("notes")) return "endnotes";
  return "back_matter";
}

// ---------------------------------------------------------------------------
// Body-level detections, applied per chapter segment.
// ---------------------------------------------------------------------------

// Pull-quotes / epigraphs / verse inside the body: a paragraph that starts
// with a quotation mark (or is a quote block) followed by a short attribution
// line ("— Source") becomes an `epigraph` node with a separate attribution;
// a lone quote without attribution stays a styled `quote` block.
function detectBodyQuotes(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const t = (b.text || "").trim();

    const isQuoteLike =
      b.type === "quote" ||
      (b.type === "paragraph" && /^[\u201C\u201D“”"'\u2018\u2019]/.test(t) && t.length < 400);
    if (!isQuoteLike) {
      out.push(b);
      continue;
    }

    const next = blocks[i + 1];
    const nt = (next?.text || "").trim();
    const isAttribution =
      next?.type === "paragraph" && /^[\u2014\u2013\-–—]/.test(nt) && nt.length < 90;

    if (isAttribution) {
      out.push({
        type: "epigraph",
        text: t,
        attribution: nt.replace(/^[\u2014\u2013\-–—\s]+/, ""),
      });
      i++;
      continue;
    }
    // No attribution — keep quote blocks as blockquotes; paragraphs stay
    // paragraphs (a stray quotation in prose is not an epigraph).
    if (b.type === "quote") out.push(b);
    else out.push(b);
  }
  return out;
}

// Run-in subheads (A.3): a short line (< 80 chars) that ends with a colon,
// or carries no terminal sentence punctuation, and is followed by a real
// paragraph becomes a level-3 heading instead of body text.  Heuristic
// detections carry `confidence` so the preflight report can flag them.
function detectRunInHeads(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const next = blocks[i + 1];
    if (b.type !== "paragraph") {
      out.push(b);
      continue;
    }
    const t = (b.text || "").trim();
    const nextText = (next?.text || "").trim();
    const nextIsBody =
      (next?.type === "paragraph" && nextText.length > 80) ||
      next?.type === "list_ordered" ||
      next?.type === "list_unordered";
    if (!nextIsBody || !t || t.length >= 80) {
      out.push(b);
      continue;
    }
    // Never promote structural markers or front-matter-looking lines.
    if (/^(chapter|part|book|practice)\b/i.test(t) || SPACED_PRACTICE_RE.test(t)) {
      out.push(b);
      continue;
    }
    if (/^[\u201C\u201D“”"'\u2018\u2019\-–—•*]/.test(t)) {
      out.push(b); // quotations, attributions, list bullets
      continue;
    }
    const words = t.split(/\s+/).filter(Boolean);
    const endsWithColon = /[:：]\s*$/.test(t);
    const noTerminalPunct = !/[.!?…]["'’”)]?$/.test(t);
    const capRatio =
      words.filter((w) => /^[A-Z\u0900-\u097F]/.test(w)).length / Math.max(1, words.length);
    if (endsWithColon || (noTerminalPunct && words.length >= 2 && capRatio >= 0.34)) {
      out.push({
        type: "heading_h3",
        text: t.replace(/[:：]\s*$/, ""),
        level: 3,
        confidence: endsWithColon ? 0.85 : 0.7,
      });
      continue;
    }
    out.push(b);
  }
  return out;
}

const SPACED_PRACTICE_RE = /^\s*P\s*R\s*A\s*C\s*T\s*I\s*C\s*E\s*:?\.?\s*$/i;

// Convert "Practice — Title" headings (and bare "PRACTICE" marker lines,
// including the spaced-letter "P R A C T I C E" form) plus their content into
// practice_box blocks.  Consecutive "1. step" paragraphs inside a box are
// folded into a single ordered list — the visible numbering is preserved.
function convertPracticeBoxes(blocks: Block[]): Block[] {
  const STEP_RE = /^\s*(\d{1,2})[.)]\s+(.+)$/s;
  const collectInner = (startIdx: number): { inner: Block[]; end: number } => {
    const inner: Block[] = [];
    let j = startIdx;
    let pendingSteps: string[] = [];
    const flushSteps = () => {
      if (pendingSteps.length > 0) {
        inner.push({ type: "list_ordered", items: pendingSteps });
        pendingSteps = [];
      }
    };
    while (j < blocks.length) {
      const cb = blocks[j];
      if (cb.type === "heading_h1" || cb.type === "heading_h2" || cb.type === "heading_h3") break;
      if (cb.type === "paragraph" && SPACED_PRACTICE_RE.test((cb.text || "").trim())) break;
      const stepMatch = cb.type === "paragraph" ? (cb.text || "").match(STEP_RE) : null;
      if (stepMatch) {
        pendingSteps.push(stepMatch[2].trim());
        j++;
        continue;
      }
      flushSteps();
      inner.push(cb);
      j++;
    }
    flushSteps();
    return { inner, end: j };
  };

  const out: Block[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    const t = (b.text || "").trim();
    if (b.type === "paragraph" && SPACED_PRACTICE_RE.test(t)) {
      // The next block is the title (an h3, or a short standalone paragraph).
      let label = "";
      let contentStart = i + 1;
      if (contentStart < blocks.length) {
        const next = blocks[contentStart];
        const nt = (next.text || "").trim();
        const shortPara =
          next.type === "paragraph" && nt.length < 90 && !/^\d/.test(nt);
        if (next.type.startsWith("heading") || shortPara) {
          label = nt;
          contentStart++;
        }
      }
      const { inner, end } = collectInner(contentStart);
      out.push({ type: "practice_box", label, blocks: inner });
      i = end;
      continue;
    }
    if ((b.type === "heading_h1" || b.type === "heading_h2" || b.type === "heading_h3") && /^practice\b/i.test(t)) {
      // "Practice — Meeting Sensation Directly" -> label "Meeting Sensation Directly"
      const label = t.replace(/^practice\s*[—\-–:]\s*/i, "").trim();
      const { inner, end } = collectInner(i + 1);
      out.push({ type: "practice_box", label, blocks: inner });
      i = end;
      continue;
    }
    out.push(b);
    i++;
  }
  return out;
}

// Split a flat list of front-matter blocks (everything before the first
// chapter) into discrete typed entries: title_page, copyright, epigraph(s),
// note/preface, and toc.  This is the core of QA #2/#3/#7 — the old code
// dumped everything into one "Front matter" paragraph stream.
//
// Heuristics, in order:
//   - A heading or short paragraph containing "copyright" or "©" starts a
//     copyright entry (and ends the title-page group).
//   - Quote blocks followed by an attribution line ("— Source") become
//     epigraph entries.
//   - A heading "Contents" / "Table of Contents" starts a ToC entry.
//   - Any other heading (h2/h3/h1 that isn't a chapter marker) starts a
//     named section entry (note, preface, etc.).
function splitFrontMatter(
  blocks: Block[],
  meta: { title: string; subtitle?: string; author?: string }
): FrontMatterEntry[] {
  const entries: FrontMatterEntry[] = [];
  let i = 0;

  // The title page is handled by the template (it renders title/subtitle/
  // author from metadata).  We still emit a title_page entry so the generator
  // knows to skip any title-page blocks in the source rather than dumping
  // them as body text.
  const titlePageBlocks: Block[] = [];
  while (i < blocks.length) {
    const b = blocks[i];
    const t = (b.text || "").trim();
    // Stop the title page at the first copyright marker, epigraph, or
    // heading that isn't the title itself.
    if (/copyright|©|all rights reserved/i.test(t)) break;
    if (b.type === "quote") break;
    if ((b.type === "heading_h2" || b.type === "heading_h3" || b.type === "heading_h1") &&
        i > 0) break;
    titlePageBlocks.push(b);
    i++;
  }
  if (titlePageBlocks.length > 0) {
    entries.push({ type: "title_page", title: "", blocks: titlePageBlocks });
  }

  // Copyright page: collect blocks until the next epigraph, heading, or
  // epigraph-like paragraph.  Mammoth doesn't always tag italic quotes as
  // <blockquote>, so epigraphs often arrive as plain paragraphs starting
  // with a quotation mark.  Without this stop condition, epigraphs get
  // absorbed into the copyright block and render as one mashed paragraph.
  // With pdfjs extraction, the "Copyright ©" line can arrive as a
  // heading_h3 — treat a heading that itself contains the copyright marker
  // as part of the copyright block rather than a section boundary.
  if (i < blocks.length && /copyright|©|all rights reserved/i.test(blocks[i].text || "")) {
    const copyBlocks: Block[] = [];
    while (i < blocks.length) {
      const b = blocks[i];
      if (b.type === "quote") break;
      const t = (b.text || "").trim();
      const isHeading = b.type === "heading_h1" || b.type === "heading_h2" || b.type === "heading_h3";
      // A heading containing the copyright marker is the copyright page's
      // own title ("Copyright © Binary Bodhi") — keep it.  Any other
      // heading starts a new section.
      if (isHeading && copyBlocks.length > 0) break;
      if (isHeading && !/copyright|©|all rights reserved/i.test(t)) break;
      // Stop at epigraph-like paragraphs: a short paragraph that starts
      // with a quotation mark, or a paragraph that looks like an
      // attribution line ("— Source").
      if (b.type === "paragraph" && copyBlocks.length > 0) {
        if (/^[\u201C\u201D"'\u2018\u2019]/.test(t) && t.length < 300) break;
        if (/^[\u2014\u2013\-–—]/.test(t) && t.length < 80) break;
      }
      copyBlocks.push(b);
      i++;
    }
    // Merge copyright blocks into a single copyright block.
    const copyText = copyBlocks
      .map((b) => b.text || "")
      .join("\n")
      .trim();
    if (copyText) {
      entries.push({
        type: "copyright",
        title: "",
        blocks: [{ type: "copyright", text: copyText }],
      });
    }
  }

  // Walk the rest: epigraphs, ToC, and named sections.
  while (i < blocks.length) {
    const b = blocks[i];
    const t = (b.text || "").trim();

    // ToC
    if (/^(table of contents|contents)$/i.test(t)) {
      const tocBlocks: Block[] = [];
      i++;
      while (i < blocks.length) {
        const tb = blocks[i];
        const tt = (tb.text || "").trim();
        // ToC ends at the first heading that isn't "Contents".
        if (tb.type === "heading_h1" || tb.type === "heading_h2" || tb.type === "heading_h3") break;
        // Heuristic: ToC entries contain dot leaders or trailing page numbers.
        // Stop when we hit a paragraph that doesn't look like a ToC entry.
        if (tb.type === "paragraph" && !/\.{3,}|…|\s\d+\s*$|·/.test(tt) && tocBlocks.length > 0) break;
        tocBlocks.push(tb);
        i++;
      }
      // Parse ToC paragraph text into individual toc_entry blocks.
      const tocEntries = parseTocEntries(tocBlocks);
      entries.push({ type: "toc", title: "Contents", blocks: tocEntries });
      continue;
    }

    // Epigraph: a quote (or epigraph-like paragraph) followed by an
    // attribution line.  Mammoth doesn't always tag italic quotes as
    // <blockquote>, so we also detect paragraphs that start with a
    // quotation mark and are followed by an attribution ("— Source").
    if (b.type === "quote" || (b.type === "paragraph" && /^[\u201C\u201D"'\u2018\u2019]/.test(t) && t.length < 300)) {
      const quoteText = (b.text || "").trim();
      let attribution = "";
      // The next block is often the attribution ("— Source").
      if (i + 1 < blocks.length) {
        const next = blocks[i + 1];
        const nt = (next.text || "").trim();
        if (next.type === "paragraph" && /^[\u2014\-–—]/.test(nt) && nt.length < 80) {
          attribution = nt.replace(/^[\u2014\-–—\s]+/, "");
          i++;
        }
      }
      entries.push({
        type: "epigraph",
        title: "",
        blocks: [{ type: "epigraph", text: quoteText, attribution }],
      });
      i++;
      continue;
    }

    // Named section (note, preface, etc.): a heading starts a new entry.
    if (b.type === "heading_h1" || b.type === "heading_h2" || b.type === "heading_h3") {
      const sectionTitle = t;
      const sectionBlocks: Block[] = [];
      i++;
      while (i < blocks.length) {
        const sb = blocks[i];
        if (sb.type === "heading_h1" || sb.type === "heading_h2" || sb.type === "heading_h3") break;
        if (/^(table of contents|contents)$/i.test((sb.text || "").trim())) break;
        // Epigraph-like content (quotes, quoted paragraphs) following a
        // section heading is its own entry — don't absorb it into the
        // section body.
        if (sb.type === "quote") break;
        const st = (sb.text || "").trim();
        if (sb.type === "paragraph" && /^[\u201C\u201D"'\u2018\u2019]/.test(st) && st.length < 300) break;
        sectionBlocks.push(sb);
        i++;
      }
      const fmType = detectFrontMatterType(sectionBlocks);
      entries.push({
        type: fmType,
        title: sectionTitle,
        blocks: sectionBlocks,
      });
      continue;
    }

    // Orphan paragraph (not under any heading) — append to the last entry
    // if it's a named section, otherwise skip (title-page leftovers).
    const last = entries[entries.length - 1];
    if (last && last.type !== "title_page" && last.type !== "copyright" && last.type !== "epigraph" && last.type !== "toc") {
      last.blocks.push(b);
    }
    i++;
  }

  return entries;
}

// Parse ToC paragraph blocks (which contain multiple entries concatenated
// into one paragraph due to PDF text extraction) into individual toc_entry
// blocks with label + page number.
function parseTocEntries(blocks: Block[]): Block[] {
  const entries: Block[] = [];
  for (const b of blocks) {
    const text = (b.text || "").trim();
    if (!text) continue;
    // Split on the pattern "Title.....Page" — the dot leader is the separator.
    // Also handle "PART X · Name" part-divider lines (no page number).
    const lines = text.split(/\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Part divider: "PART ONE · The Break"
      const partMatch = trimmed.match(/^(PART\s+[A-Z]+)\s*[·•]\s*(.+)$/i);
      if (partMatch && !/\.{3,}|…|\s\d+\s*$/.test(trimmed)) {
        entries.push({ type: "toc_entry", text: trimmed, page: undefined });
        continue;
      }
      // Chapter entry: "One · The Night the Floor Went.....5"
      const entryMatch = trimmed.match(/^(.+?)\.{3,}(\d+)\s*$/);
      if (entryMatch) {
        entries.push({
          type: "toc_entry",
          text: entryMatch[1].trim(),
          page: parseInt(entryMatch[2], 10),
        });
        continue;
      }
      // Entry with trailing page number but no dot leader
      const plainMatch = trimmed.match(/^(.+?)\s+(\d+)\s*$/);
      if (plainMatch && /·/.test(trimmed)) {
        entries.push({
          type: "toc_entry",
          text: plainMatch[1].trim(),
          page: parseInt(plainMatch[2], 10),
        });
        continue;
      }
      // Unparseable line — keep as a plain toc_entry without a page number
      if (trimmed.length > 3) {
        entries.push({ type: "toc_entry", text: trimmed, page: undefined });
      }
    }
  }
  return entries;
}

const DOUBLE_SPACE_REGEX = /[^\n]\s{2,}[^\n]/g;
const REPEATED_WORD_REGEX = /\b(\w+)\s+\1\b/gi;

// Unicode script ranges for non-Latin scripts that appear in manuscripts.
// Used by the script-sanity check (#5) to detect corrupted source text where
// a "Devanagari" span is actually just 2–3 distinct code points repeated
// dozens of times (a known PDF text-extraction failure mode).
const SCRIPT_RANGES: { name: string; from: number; to: number }[] = [
  { name: "Devanagari", from: 0x0900, to: 0x097f },
  { name: "Bengali", from: 0x0980, to: 0x09ff },
  { name: "Gurmukhi", from: 0x0a00, to: 0x0a7f },
  { name: "Gujarati", from: 0x0a80, to: 0x0aff },
  { name: "Tamil", from: 0x0b80, to: 0x0bff },
  { name: "Malayalam", from: 0x0d00, to: 0x0d7f },
];

// Check a text span for suspiciously low character diversity within a non-
// Latin script.  Returns the script name if the span looks corrupted, or null
// if it looks fine.  A "corrupted" span is one with >= 20 non-Latin characters
// but fewer than 5 distinct code points — real text always has more.
function detectCorruptedScript(text: string): string | null {
  for (const range of SCRIPT_RANGES) {
    const chars: Set<string> = new Set();
    let count = 0;
    for (const ch of text) {
      const cp = ch.codePointAt(0)!;
      if (cp >= range.from && cp <= range.to) {
        chars.add(ch);
        count++;
      }
    }
    if (count >= 20 && chars.size < 5) {
      return range.name;
    }
  }
  return null;
}

function generateWarnings(
  blocks: Block[],
  chapters: ChapterEntry[],
  estimatedPages: number
): WarningItem[] {
  const warnings: WarningItem[] = [];
  let pageCursor = 1;
  const wordsPerPageEstimate = 275;
  let wordsAccum = 0;

  const bumpPage = (wordAdd: number) => {
    wordsAccum += wordAdd;
    while (wordsAccum >= wordsPerPageEstimate) {
      wordsAccum -= wordsPerPageEstimate;
      pageCursor++;
    }
  };

  for (const block of blocks) {
    const texts: string[] = [];
    if (block.text) texts.push(block.text);
    if (block.items) texts.push(...block.items);
    if (block.rows) {
      for (const r of block.rows) for (const c of r.cells) texts.push(c.text);
    }
    for (const t of texts) {
      if (!t) continue;
      const bw = countWords(t);
      const doubleMatches: string[] | null = t.match(DOUBLE_SPACE_REGEX);
      if (doubleMatches && doubleMatches.length > 0) {
        for (let i = 0; i < Math.min(doubleMatches.length, 3); i++) {
          warnings.push({
            code: "double_spaces",
            level: "info",
            message: "Double-space detected inside paragraph.",
            page: Math.max(1, Math.min(estimatedPages, pageCursor)),
          });
        }
      }
      const repeatMatches: string[] | null = t.match(REPEATED_WORD_REGEX);
      if (repeatMatches && repeatMatches.length > 0) {
        for (let i = 0; i < Math.min(repeatMatches.length, 3); i++) {
          warnings.push({
            code: "repeated_word",
            level: "warning",
            message: `Repeated word detected: "${repeatMatches[i]}"`,
            page: Math.max(1, Math.min(estimatedPages, pageCursor)),
          });
        }
      }
      // Unicode/script sanity check (#5): flag non-Latin script spans with
      // suspiciously low character diversity — a sign of corrupted PDF text
      // extraction (e.g. "ततत तततततत" instead of real Devanagari verse).
      const corruptedScript = detectCorruptedScript(t);
      if (corruptedScript) {
        warnings.push({
          code: "corrupted_script",
          level: "warning",
          message: `Possible corrupted ${corruptedScript} text detected — please re-check this passage before printing.`,
          page: Math.max(1, Math.min(estimatedPages, pageCursor)),
        });
      }
      bumpPage(bw);
    }
  }

  for (const ch of chapters) {
    if (ch.wordCount === 0) {
      warnings.push({
        code: "empty_chapter",
        level: "warning",
        message: `Chapter ${ch.number} "${ch.title}" appears to have no content.`,
      });
    }
    if (ch.wordCount > 0 && ch.wordCount < 50) {
      warnings.push({
        code: "short_chapter",
        level: "info",
        message: `Chapter ${ch.number} "${ch.title}" is very short (${ch.wordCount} words).`,
      });
    }
  }

  return warnings;
}

function detectBookType(
  rawText: string,
  blocks: Block[],
  chapterCount: number
): BookType {
  const t = rawText.toLowerCase();
  const quotes = blocks.filter((b) => b.type === "quote").length;
  const tables = blocks.filter((b) => b.type === "table").length;
  const refs = blocks.filter(
    (b) => b.type === "bibliography" || b.type === "reference" || b.type === "footnote"
  ).length;

  if (refs > 10 || tables > 2 || /\bcitation\b|\bbibliography\b|\breference\b/.test(t)) {
    return "academic";
  }
  if (
    /\bmeditation\b|\bcontemplation\b|\bwisdom\b|\bphilos\b|\betics\b|\bmetaphysic\b/.test(t) ||
    (quotes > 5 && chapterCount < 10)
  ) {
    return "philosophy";
  }
  if (/\b(yoga|sutra|mantra|guru|buddha|dharma|tantra|puja|bhakti|krishna|shiva|vedanta|sanskrit)\b/.test(t) ||
    /[\u0900-\u097F]/.test(t)) {
    return "spiritual";
  }
  if (
    /\bbusiness\b|\bmanagement\b|\bleader\b|\bprofit\b|\bstrategy\b|\brevenue\b|\bstartup\b/.test(t)
  ) {
    return "business";
  }
  if (/\bchild\b|\bstorybook\b|\billustrated\b/i.test(t) || chapterCount < 5) {
    const images = blocks.filter((b) => b.type === "image").length;
    if (images > 3) return "childrens";
  }
  if (/\bmemoir\b|\bautobiography\b|\bbiography\b|\bchildhood\b|\bi grew up\b|\bmy life\b/.test(t)) {
    return "memoir";
  }
  if (chapterCount >= 3) return "novel";
  return "other";
}

function normalizeLine(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function looksLikeAuthorName(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 60) return false;
  const wc = t.split(/\s+/).length;
  if (wc < 1 || wc > 5) return false;
  if (/[.!?;:,]$/.test(t)) return false;
  // Capitalized name tokens only (Latin or Devanagari initials), e.g. "Jane Austen", "J. R. R. Tolkien"
  return /^[A-Z\u0900-\u097F][\p{L}.'\u2019-]*(?:\s+[A-Z\u0900-\u097F][\p{L}.'\u2019-]*){0,4}$/u.test(t);
}

function extractTitleAndAuthor(
  blocks: Block[],
  rawText: string,
  filename: string
): { title: string; subtitle?: string; author?: string } {
  let title = "";
  let subtitle: string | undefined;
  let author: string | undefined;

  const base = (filename.split(/[\\/]/).pop() || filename)
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  // An all-lowercase ASCII filename ("my novel") reads better title-cased on
  // the title page; anything already cased is left alone.
  const nameFromFile = /^[a-z0-9 '’\-]+$/.test(base)
    ? base.replace(/\b[a-z]/g, (c) => c.toUpperCase())
    : base;

  const firstHeadings = blocks.filter(
    (b) =>
      b.type === "heading_h1" ||
      b.type === "heading_h2" ||
      b.type === "heading_h3" ||
      b.type === "paragraph"
  );

  let blockIdx = 0;
  let seenParagraph = false;
  for (const b of firstHeadings) {
    blockIdx++;
    const txt = (b.text || "").trim();
    if (!txt) continue;
    if (b.type === "paragraph") seenParagraph = true;
    // Chapter markers ("Chapter 1", "Book III") are content headings, never
    // the book title — and nothing after the first one is title-page material.
    // A manuscript that opens straight into "Chapter 1" has no title page;
    // fall back to the filename rather than promoting a heading from the body.
    if (matchChapterHeading(b)) break;
    // Title-page material lives in the first handful of blocks.  Beyond that
    // we're in the body; stop before an interior section head gets promoted.
    if (!title && blockIdx > 8) break;
    if (b.type === "heading_h1" || b.type === "heading_h2" || b.type === "heading_h3") {
      if (!title) {
        title = txt;
        continue;
      }
      // Only h1/h2 before body text starts can be the subtitle — section
      // heads ("I.1: On Debt…", "A Note Before We Begin") are not subtitles.
      if (
        title && !subtitle && txt.length < 120 && !seenParagraph &&
        (b.type === "heading_h1" || b.type === "heading_h2")
      ) {
        subtitle = txt;
        break;
      }
    }
    if (!title && b.type === "paragraph" && txt.length < 120 && countWords(txt) <= 10) {
      title = txt;
      continue;
    }
    // A short Latin line right after the title is the subtitle ("On Seeing
    // Clearly and Forgetting Anyway") — it arrives as a paragraph, not a
    // heading. Latin-only: Indic opening invocations are epigraphs, not
    // subtitles.
    if (
      title && !subtitle && b.type === "paragraph" && blockIdx <= 4 &&
      /^[A-Z][A-Za-z'’\- ]+$/.test(txt) &&
      countWords(txt) >= 2 && countWords(txt) <= 10 &&
      !looksLikeAuthorName(txt)
    ) {
      subtitle = txt;
      continue;
    }
    if (title && !author) {
      const byline = txt.match(/^(?:by|written by|author|authored by)\s+(.+)$/i);
      if (byline && looksLikeAuthorName(byline[1])) {
        author = byline[1].trim();
        break;
      }
      if (
        b.type === "paragraph" &&
        countWords(txt) >= 1 &&
        countWords(txt) <= 5 &&
        txt.length < 80 &&
        blockIdx <= 8 && // author lines live on the title page — a short
        looksLikeAuthorName(txt) // capitalized line deeper in is more likely a heading
      ) {
        author = txt;
        break;
      }
    }
    if (title && subtitle && author) break;
  }

  if (!title) {
    title = nameFromFile || "Untitled Manuscript";
  }

  // PDF title pages merge title/subtitle/author into one copyright paragraph —
  // recover the subtitle from the raw line right after the title line.
  if (!subtitle && title) {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim());
    const ti = lines.findIndex((l) => l === title || l === title.toUpperCase() || (title.length > 3 && l === title));
    if (ti >= 0) {
      for (let j = ti + 1; j < Math.min(ti + 4, lines.length); j++) {
        const l = lines[j];
        if (!l || /^[\d\s\-–—]*$/.test(l)) continue; // blanks & page numbers
        if (
          /^[A-Z][A-Za-z'’\- ]+$/.test(l) &&
          l.split(/\s+/).length >= 2 && l.split(/\s+/).length <= 10 &&
          !looksLikeAuthorName(l)
        ) {
          subtitle = l;
        }
        break;
      }
    }
  }

  const authorMatch = rawText.match(/^[\s\uFEFF]*(?:by|written by)\s+([^\n]{1,60})$/im);
  if (!author && authorMatch && looksLikeAuthorName(authorMatch[1])) {
    author = authorMatch[1].trim();
  }

  // PDF exports often fold the author line into the copyright paragraph — scan
  // the raw title-page lines directly for a name-shaped line. Interior
  // headings are name-shaped too ("Key Discoveries Awaiting"), so any line
  // that was parsed as a heading can never become the byline.
  if (!author) {
    const headingTexts = new Set(
      blocks
        .filter((b) => b.type.startsWith("heading"))
        .map((b) => normalizeLine(b.text || ""))
    );
    const earlyLines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 15);
    for (const l of earlyLines) {
      if (l === title || l === subtitle) continue;
      if (headingTexts.has(normalizeLine(l))) continue;
      if (/^(copyright|©|all rights|isbn)/i.test(l)) continue;
      if (/^(book|chapter|part|section|page|volume)\b/i.test(l)) continue;
      if (/^[—–\-•*"“‘'’\u0964\u0965]/.test(l)) continue; // epigraphs, quotes, ornaments
      if (looksLikeAuthorName(l)) {
        author = l;
        break;
      }
    }
  }

  return { title, subtitle, author };
}

async function llmEnhance(
  structure: BookStructureV1,
  rawText: string
): Promise<BookStructureV1> {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key === "sk-placeholder") {
    return structure;
  }

  let baseUrl = process.env.OPENAI_COMPATIBLE_BASE_URL || "https://api.openai.com/v1";
  baseUrl = baseUrl.replace(/\/$/, "");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const sampleWordCount = countWords(rawText);
    const previewChars = sampleWordCount > 8000 ? Math.min(8000, rawText.length) : rawText.length;
    const prompt =
`You are a book-structure validator. Given the extracted structure and raw text preview, return a strict JSON object with only these keys (NO other keys):
{
  "title": "string",
  "subtitle": "string | null",
  "author": "string | null",
  "detectedBookType": "novel|philosophy|academic|business|memoir|spiritual|childrens|other"
}

Existing extracted values (use as defaults when uncertain):
title=${JSON.stringify(structure.title)}
subtitle=${JSON.stringify(structure.subtitle ?? null)}
author=${JSON.stringify(structure.author ?? null)}
detectedBookType=${JSON.stringify(structure.detectedBookType ?? null)}
chapterCount=${structure.chapterCount}

Raw text preview (first ${previewChars} chars):
${rawText.slice(0, previewChars)}

Never fabricate. Never rewrite. Respond with JSON only.`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0,
        max_tokens: 250,
        messages: [
          {
            role: "system",
            content: "You are a precise JSON-producing assistant. Respond with valid JSON only.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) return structure;
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json?.choices?.[0]?.message?.content;
    if (!content) return structure;
    const parsed = JSON.parse(content) as {
      title?: string;
      subtitle?: string | null;
      author?: string | null;
      detectedBookType?: BookType;
    };
    const out: BookStructureV1 = {
      ...structure,
      title: (parsed.title && parsed.title.trim()) || structure.title,
    };
    if (parsed.subtitle !== undefined && parsed.subtitle !== null) {
      out.subtitle = parsed.subtitle || undefined;
    }
    if (parsed.author !== undefined && parsed.author !== null) {
      out.author = parsed.author || undefined;
    }
    if (parsed.detectedBookType) {
      out.detectedBookType = parsed.detectedBookType;
    }
    return out;
  } catch {
    return structure;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function analyzeManuscript(
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<BookStructureV1> {
  const isDocx =
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(filename);
  const isPdf = mimeType === "application/pdf" || /\.pdf$/i.test(filename);

  let blocks: Block[] = [];
  let rawText = "";
  let parseFixes: string[] = [];

  if (isDocx) {
    const result = await parseDocx(buffer);
    blocks = result.blocks;
    rawText = result.rawText;
    parseFixes = result.fixes || [];
  } else if (isPdf) {
    const result = await parsePdf(buffer);
    blocks = result.blocks;
    rawText = result.rawText;
    // pdf-parse can fail silently on scanned/image-only or malformed PDFs and
    // return empty text. Surfacing this here prevents a silent empty book (or
    // worse, a corrupt render) downstream.
    if (!rawText.trim() && blocks.length === 0) {
      throw new Error(
        "Couldn't extract any text from this PDF. It may be a scanned/image-only PDF or use an unsupported encoding. Try uploading a text-based PDF or a .docx file."
      );
    }
  } else {
    rawText = buffer.toString("utf8");
    const paragraphs = rawText.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    blocks = paragraphs.map((p) => ({ type: "paragraph" as const, text: p }));
  }

  const totalWords = countBlocksWords(blocks);
  const estimatedPages = Math.max(1, Math.ceil(totalWords / 275));

  const meta = extractTitleAndAuthor(blocks, rawText, filename);
  const chapterMatches = findChapterBoundaries(blocks);

  const frontMatterBlocks: Block[] = [];
  const chapterSegments: Array<{ match: ChapterHeadingMatch; blocks: Block[] }> = [];

  if (chapterMatches.length === 0) {
    // No explicit "Chapter N" markers — fall back to treating every h1 as a
    // chapter boundary.  But exclude front-matter named sections (Preface,
    // Contents, Note, etc.) and Practice sections — those are not chapters.
    // Part dividers ARE included as segments because they're structural
    // elements within the body (rendered as level-0 part openers).
    const FRONT_MATTER_HEADINGS = /^(preface|foreword|prologue|introduction|contents|table of contents|acknowledge?ments?|dedication|note|a note|epilogue|afterword)/i;
    const isTitleHeading = (b: Block, i: number) =>
      i < 3 && (b.text || "").trim().toLowerCase() === meta.title.trim().toLowerCase();
    const firstH1 = blocks.findIndex(
      (b, i) =>
        b.type === "heading_h1" &&
        !isTitleHeading(b, i) &&
        !FRONT_MATTER_HEADINGS.test((b.text || "").trim()) &&
        !/^practice\b/i.test((b.text || "").trim())
    );
    if (firstH1 >= 0) {
      const fakeMatch: ChapterHeadingMatch = {
        blockIndex: firstH1,
        chapterNumber: 1,
        rawTitle: blocks[firstH1].text || "Untitled",
        headingType: "heading_h1",
        kind: "chapter",
      };
      chapterMatches.push(fakeMatch);
      let counter = 1;
      for (let i = firstH1 + 1; i < blocks.length; i++) {
        if (blocks[i].type === "heading_h1") {
          const h1Text = (blocks[i].text || "").trim();
          // Skip front-matter named sections and Practice sections.
          if (FRONT_MATTER_HEADINGS.test(h1Text) || /^practice\b/i.test(h1Text)) continue;
          // Real markers keep their detected kind (part / backmatter).
          const detected = matchChapterHeading(blocks[i]);
          if (detected) {
            detected.blockIndex = i;
            if (detected.kind !== "backmatter") {
              counter++;
              if (!detected.chapterNumber) detected.chapterNumber = counter;
            }
            chapterMatches.push(detected);
            continue;
          }
          counter++;
          chapterMatches.push({
            blockIndex: i,
            chapterNumber: counter,
            rawTitle: blocks[i].text || `Chapter ${counter}`,
            headingType: "heading_h1",
            kind: "chapter",
          });
        }
      }
    } else {
      // No heading_h1 blocks at all — completely unstructured document
      // (e.g. a Malayalam or other non-English DOCX with only paragraphs).
      // Treat the entire document as a single chapter rather than dumping
      // everything into frontMatter, which would produce a book with only
      // a title page and no body content.
      if (blocks.length > 0) {
        // Use the detected document title as the chapter name for
        // completely unstructured docs — "Chapter 1" is meaningless when
        // the doc has no real chapter structure.
        chapterMatches.push({
          blockIndex: 0,
          chapterNumber: 1,
          rawTitle: meta.title || "Chapter 1",
          headingType: "paragraph",
        });
      } else {
        frontMatterBlocks.push(...blocks);
      }
    }
  }

  // Does a block read as a short standalone title line (a chapter title
  // following a bare "CHAPTER N" marker, or a part title/subtitle)?
  const isTitleLine = (b: Block): boolean => {
    if (b.type === "heading_h1" || b.type === "heading_h2" || b.type === "heading_h3") return true;
    if (b.type !== "paragraph") return false;
    const t = (b.text || "").trim();
    if (!t || t.length > 90) return false;
    if (/[.!?…]["'’”)]?$/.test(t) && t.split(/\s+/).length > 4) return false;
    return true;
  };

  if (chapterMatches.length > 0) {
    const firstIdx = chapterMatches[0].blockIndex;
    for (let i = 0; i < firstIdx; i++) {
      frontMatterBlocks.push(blocks[i]);
    }
    for (let mi = 0; mi < chapterMatches.length; mi++) {
      const cm = chapterMatches[mi];
      const start = cm.blockIndex + 1;
      const end =
        mi + 1 < chapterMatches.length ? chapterMatches[mi + 1].blockIndex : blocks.length;
      const segmentBlocks: Block[] = [];
      for (let i = start; i < end; i++) {
        segmentBlocks.push(blocks[i]);
      }
      // A chapter = ONE heading node {number, title}.  A bare marker line
      // ("CHAPTER TEN") followed by a title line is merged here — the title
      // block is consumed so it never renders as a stray body paragraph or
      // as a second heading.
      if (cm.takeTitleFromNext && segmentBlocks.length > 0 && isTitleLine(segmentBlocks[0])) {
        cm.rawTitle = (segmentBlocks[0].text || "").trim();
        segmentBlocks.shift();
        // A second short line after a part title is the subtitle.
        if (
          cm.kind === "part" &&
          segmentBlocks.length > 0 &&
          segmentBlocks[0].type === "paragraph" &&
          (segmentBlocks[0].text || "").trim().length <= 120
        ) {
          (cm as ChapterHeadingMatch & { subtitle?: string }).subtitle =
            (segmentBlocks[0].text || "").trim();
          segmentBlocks.shift();
        }
      } else if (cm.kind === "part" && !cm.takeTitleFromNext && segmentBlocks.length > 0 &&
                 segmentBlocks[0].type === "paragraph" &&
                 (segmentBlocks[0].text || "").trim().length <= 120) {
        // "PART ONE — The Break" still may carry a subtitle line after it.
        const maybeSub = (segmentBlocks[0].text || "").trim();
        if (!/[.!?]$/.test(maybeSub) || maybeSub.length < 40) {
          (cm as ChapterHeadingMatch & { subtitle?: string }).subtitle = maybeSub;
          segmentBlocks.shift();
        }
      }
      chapterSegments.push({ match: cm, blocks: segmentBlocks });
    }
  }

  const backMatterBlocks: Block[] = [];
  const backMatterEntries: BackMatterEntry[] = [];

  // Back-matter boundary segments become their own entries, each titled with
  // its own verbatim heading — "Endnotes" is never labelled "About the Author".
  const keptSegments: typeof chapterSegments = [];
  for (const seg of chapterSegments) {
    if (seg.match.kind === "backmatter") {
      backMatterEntries.push({
        type: detectBackMatterType(seg.blocks.concat(seg.match.rawTitle ? [{ type: "paragraph", text: seg.match.rawTitle }] : [])),
        title: seg.match.rawTitle,
        blocks: seg.blocks,
      });
    } else {
      keptSegments.push(seg);
    }
  }
  chapterSegments.length = 0;
  chapterSegments.push(...keptSegments);

  const lastSegmentWords =
    chapterSegments.length > 0
      ? countBlocksWords(chapterSegments[chapterSegments.length - 1].blocks)
      : 0;
  const thresholdRatio = 0.05;

  if (chapterSegments.length > 1) {
    let avgWords = 0;
    for (const s of chapterSegments) avgWords += countBlocksWords(s.blocks);
    avgWords = Math.max(1, Math.floor(avgWords / chapterSegments.length));
    const last = chapterSegments[chapterSegments.length - 1];
    const lastTitleLower = last.match.rawTitle.toLowerCase();
    if (
      (lastTitleLower.includes("appendix") ||
        lastTitleLower.includes("bibliography") ||
        lastTitleLower.includes("index") ||
        lastTitleLower.includes("glossary") ||
        lastTitleLower.includes("endnotes") ||
        lastTitleLower.includes("notes") ||
        lastTitleLower.includes("afterword") ||
        lastTitleLower.includes("epilogue") ||
        lastTitleLower.includes("about the author") ||
        lastTitleLower.includes("references")) &&
      lastSegmentWords < avgWords * 1.5
    ) {
      backMatterBlocks.push(...last.blocks);
      const lastHeadingBlock = blocks[last.match.blockIndex];
      if (lastHeadingBlock) backMatterBlocks.unshift(lastHeadingBlock);
      chapterSegments.pop();
    } else if (lastSegmentWords < Math.max(50, totalWords * thresholdRatio) && chapterSegments.length > 1) {
      const prev = chapterSegments[chapterSegments.length - 2];
      const prevWords = countBlocksWords(prev.blocks);
      if (lastSegmentWords < prevWords * thresholdRatio && lastSegmentWords < 1000) {
        backMatterBlocks.push(...last.blocks);
        const lastHeadingBlock = blocks[last.match.blockIndex];
        if (lastHeadingBlock) backMatterBlocks.unshift(lastHeadingBlock);
        chapterSegments.pop();
      }
    }
  }

  const frontMatter: FrontMatterEntry[] = [];
  if (frontMatterBlocks.length > 0) {
    frontMatter.push(...splitFrontMatter(frontMatterBlocks, meta));
  }

  const chapters: ChapterEntry[] = chapterSegments.map((seg, idx) => {
    const number = seg.match.chapterNumber || idx + 1;
    // Convert Practice headings + their content into practice_box blocks,
    // then promote run-in subheads to level-3 headings.
    const processedBlocks = detectRunInHeads(
      convertPracticeBoxes(detectBodyQuotes(seg.blocks))
    );
    const sections = splitIntoSections(processedBlocks);
    const wordCount = countBlocksWords(seg.blocks);
    const kind = seg.match.kind === "part" ? ("part" as const) : ("chapter" as const);
    const subtitle = (seg.match as ChapterHeadingMatch & { subtitle?: string }).subtitle;
    return {
      number,
      title: seg.match.rawTitle || (kind === "part" ? "" : `Chapter ${number}`),
      wordCount,
      sections,
      kind,
      label: seg.match.marker,
      subtitle,
    };
  });

  const backMatter: BackMatterEntry[] = [...backMatterEntries];
  if (backMatterBlocks.length > 0) {
    // Heuristic tail catch (not a labelled boundary): the first block is the
    // heading itself, so use its text verbatim as the entry title and drop it
    // from the body so it doesn't render twice.
    const firstText = (backMatterBlocks[0]?.text || "").trim();
    const bmType = detectBackMatterType(backMatterBlocks);
    const useFirstAsTitle = BACK_MATTER_TITLE.test(firstText);
    backMatter.push({
      type: bmType,
      title: useFirstAsTitle
        ? firstText
        : bmType.charAt(0).toUpperCase() + bmType.slice(1).replace(/_/g, " "),
      blocks: useFirstAsTitle ? backMatterBlocks.slice(1) : backMatterBlocks,
    });
  }

  const detectedBookType = detectBookType(rawText, blocks, chapters.length);
  const scriptInfo = detectScript(rawText);

  let structure: BookStructureV1 = {
    schemaVersion: 1,
    title: meta.title,
    subtitle: meta.subtitle,
    author: meta.author,
    detectedBookType,
    chapterCount: chapters.length,
    estimatedPages,
    detectedScript: scriptInfo.script,
    scriptLabel: scriptInfo.label,
    warnings: [],
    frontMatter,
    chapters,
    backMatter,
  };

  structure.warnings = generateWarnings(blocks, chapters, estimatedPages);

  // Embedded print fonts cover Latin plus Devanagari, Tamil and Malayalam.
  // Any other Indic script falls back to a substitute face in the PDF — fine
  // for previewing, wrong for print. Warn rather than let it ship silently.
  const EMBEDDED_INDIC = new Set(["devanagari", "tamil", "malayalam"]);
  if (scriptInfo.isIndic && !EMBEDDED_INDIC.has(scriptInfo.script)) {
    structure.warnings.push({
      code: "unsupported_script",
      level: "warning",
      message:
        `${scriptInfo.label} is not yet supported for print — embedded fonts cover Devanagari (Hindi), ` +
        `Tamil and Malayalam. Your interior will render with a fallback font; please check the preview ` +
        `carefully or email books@racana.pro to request support.`,
    });
  }

  // Surface every mechanical repair the parser logged so the author can audit
  // exactly what was touched.
  for (const fix of parseFixes) {
    structure.warnings.push({ code: "text_repair", level: "info", message: fix });
  }

  // Pre-generation review checklist — flags things a human should eyeball
  // (unbalanced quotes, truncated-looking sentences, low-confidence heads,
  // odd tokens, very long paragraphs) before the book is generated.
  try {
    const { runPreflight } = await import("../renderer/preflight");
    structure.preflight = runPreflight(structure);
  } catch {
    // Preflight is advisory — never fail analysis over it.
  }

  try {
    structure = await llmEnhance(structure, rawText);
  } catch {
    // ignore LLM errors; structure is already valid
  }

  return structure;
}
