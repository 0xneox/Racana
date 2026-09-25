import type { Block, PdfParseResult } from "./types";
import { resolvePdfWorker } from "../pdf-worker";

function trimText(s: string): string {
  return s.replace(/^\s+|\s+$/g, "");
}

// Strip control characters that PDF text extraction sometimes injects
// (e.g. U+0002 STX, U+0008 BS in corrupted Devanagari spans).  These would
// otherwise trigger silent font fallbacks to system sans-serif/monospace
// fonts (Roboto, Ubuntu Mono) in the rendered PDF (#11).  We keep tab,
// newline, carriage return, and form feed (page break marker).
function stripControlChars(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function countWords(s: string): number {
  const t = trimText(s);
  if (!t) return 0;
  const devanagari = t.match(/[\u0900-\u097F]+/g);
  const devaCount = devanagari ? devanagari.reduce((n, seg) => n + seg.length, 0) : 0;
  const latinWords = t.replace(/[\u0900-\u097F]+/g, " ").match(/\S+/g);
  return (latinWords ? latinWords.length : 0) + Math.ceil(devaCount / 5);
}

function isAllCaps(s: string): boolean {
  const stripped = s.replace(/[^a-zA-Z\u0900-\u097F]/g, "");
  if (stripped.length < 3) return false;
  const hasLatin = /[a-zA-Z]/.test(stripped);
  if (hasLatin) {
    const letters = stripped.match(/[a-zA-Z]/g) || [];
    const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
    return upper > letters.length * 0.7;
  }
  return false;
}

function detectHeadingLevel(line: string, prevBlank: boolean, nextContent: boolean): number | null {
  const trimmed = trimText(line);
  if (!trimmed) return null;
  if (trimmed.length > 120) return null;

  // (?![a-zA-Z]) guards against "chapter is…"/"book in…" — 'i' is a roman
  // numeral letter, so without the boundary it would match ordinary prose.
  const chapterMatch = trimmed.match(/^chapter\s+([ivxlcdm]+|\d+)(?![a-zA-Z])/i);
  if (chapterMatch) return 1;

  const bookMatch = trimmed.match(/^book\s+([ivxlcdm]+|\d+)(?![a-zA-Z])/i);
  if (bookMatch) return 1;

  const partMatch = trimmed.match(/^part\s+([ivxlcdm]+|\d+)(?![a-zA-Z])/i);
  if (partMatch) return 1;

  const numberedMatch = trimmed.match(/^(\d+(?:\.\d+){0,2})\s+[A-Z\u0900-\u097F]/);
  if (numberedMatch) {
    const parts = numberedMatch[1].split(".").length;
    return Math.min(parts, 3) as 1 | 2 | 3;
  }

  const romanMatch = trimmed.match(/^([IVXLCDM]{2,})\b/);
  if (romanMatch && prevBlank && nextContent) return 2;

  const wordCount = countWords(trimmed);
  if (wordCount <= 12 && prevBlank && nextContent && isAllCaps(trimmed)) {
    return 2;
  }

  if (wordCount <= 8 && prevBlank && nextContent && trimmed.length < 60) {
    const hasUpperCaseStart = /^[A-Z\u0900-\u097F]/.test(trimmed);
    if (hasUpperCaseStart && !/[.!?;:]$/.test(trimmed)) {
      return 3;
    }
  }

  return null;
}

function detectListMarker(line: string): { type: "ordered" | "unordered"; item: string } | null {
  const trimmed = line;
  const unordered = trimmed.match(/^(\s*)([-*•·●○▪◦▸‣➢►⦿⦾]\s+)(.+)$/);
  if (unordered) {
    return { type: "unordered", item: trimText(unordered[3]) };
  }
  const ordered = trimmed.match(/^(\s*)(\d+[.)]\s+|[a-zA-Z][.)]\s+)(.+)$/);
  if (ordered) {
    return { type: "ordered", item: trimText(ordered[3]) };
  }
  return null;
}

// Standalone structural markers common in PDF exports of books: bare ordinal
// chapter numbers ("ONE", "TWELVE"), part markers, and named sections. PDFs
// rarely carry real heading markup, so these are the strongest chapter signal.
const ORDINAL_WORDS = new Map(
  [
    "one","two","three","four","five","six","seven","eight","nine","ten",
    "eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen",
    "eighteen","nineteen","twenty","twenty-one","twenty-two","twenty-three",
    "twenty-four","twenty-five","twenty-six","twenty-seven","twenty-eight",
    "twenty-nine","thirty",
  ].map((w, i) => [w, i + 1])
);

const NAMED_SECTION = /^(preface|foreword|prologue|introduction|epilogue|afterword|acknowledge?ments?|bibliography|glossary|appendix|notes(\s+on\s+.*)?|further\s+reading)$/i;

function looksLikeTitleLine(line: string): boolean {
  const t = trimText(line);
  if (!t || t.length > 70) return false;
  const words = t.split(/\s+/).length;
  if (words > 10) return false;
  if (/[.!?,;:]$/.test(t)) return false;
  return /^[A-Z0-9\u0900-\u097F"'“‘]/.test(t);
}

// "THE BREAK" -> "The Break"; ordinary titles pass through untouched.
function smartTitle(t: string): string {
  if (!isAllCaps(t)) return t;
  return t
    .toLowerCase()
    .replace(/(^|\s)(\w)/g, (_m, sep, c) => sep + c.toUpperCase());
}

function capWord(w: string): string {
  const l = w.toLowerCase();
  return l.charAt(0).toUpperCase() + l.slice(1);
}

// Returns the chapter title if `line` is a standalone structural marker.
// `nextLine` may supply the real title ("ONE" → next line "The Night the Floor
// Went"); the caller consumes that line when returned title uses it.
function detectStandaloneMarker(
  line: string,
  nextLine: string | undefined,
  isDocStart: boolean
): { title: string; consumedNext: boolean } | null {
  const t = trimText(line);
  if (!t || t.length > 80) return null;

  // PART ONE / PART 3 — may carry "· Subtitle" on the same line. The trailing
  // text must itself look like a title, otherwise it's prose that merely starts
  // with "Part One" ("Part One proposed that the self is…").
  const partMatch = t.match(/^part\s+([ivxlcdm]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b[\s:.\-—–·]*(.*)$/i);
  if (partMatch) {
    const num = capWord(partMatch[1]);
    const rest = trimText((partMatch[2] || "").replace(/^[\s:.\-—–·]+/, ""));
    if (rest && looksLikeTitleLine(rest)) return { title: `Part ${num} — ${smartTitle(rest)}`, consumedNext: false };
    if (!rest && nextLine && looksLikeTitleLine(nextLine)) {
      return { title: `Part ${num} — ${smartTitle(trimText(nextLine))}`, consumedNext: true };
    }
    if (!rest) return { title: `Part ${num}`, consumedNext: false };
    return null;
  }

  // Bare ordinal on its own line — "ONE" / "TWELVE"
  if (ORDINAL_WORDS.has(t.toLowerCase())) {
    if (nextLine && looksLikeTitleLine(nextLine)) {
      return { title: smartTitle(trimText(nextLine)), consumedNext: true };
    }
    return { title: `Chapter ${capWord(t)}`, consumedNext: false };
  }

  // Short all-caps marker that introduces a titled section — "PRACTICE" +
  // next line "Looking for the Looker". At document start, an all-caps line
  // followed by a title-ish line is almost always the book's own title page —
  // leave it alone so it lands in front matter instead of chapter 1.
  if (t.length <= 30 && isAllCaps(t) && nextLine && looksLikeTitleLine(nextLine) && !isDocStart) {
    return { title: `${capWord(t)} — ${smartTitle(trimText(nextLine))}`, consumedNext: true };
  }

  if (NAMED_SECTION.test(t)) {
    const label = t.charAt(0).toUpperCase() + t.slice(1);
    return { title: label, consumedNext: false };
  }

  return null;
}

// Page furniture injected by word processors / export tools — page numbers,
// "Page 12", "-- 3 of 40 --", bare folios. These are never book content.
function isPageFurniture(line: string): boolean {
  const t = trimText(line);
  if (!t) return false;
  if (/^[-–—*\s]*\d+\s*(of\s+\d+)?\s*[-–—*\s]*$/.test(t)) return true;
  if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(t)) return true;
  return false;
}

function detectQuote(line: string): boolean {
  const trimmed = trimText(line);
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return true;
  if (trimmed.startsWith("\u201C") && trimmed.endsWith("\u201D")) return true;
  if (trimmed.startsWith("\u2018") && trimmed.endsWith("\u2019") && trimmed.length > 20) return true;
  if (/^[\s\u00A0]{4,}/.test(line) && trimmed.length > 30) return true;
  return false;
}

export async function parsePdf(buffer: Buffer): Promise<PdfParseResult> {
  let rawText = "";
  let pageCount = 0;

  try {
    const mod: any = await import("pdf-parse");
    const PDFParse = mod.PDFParse || mod.default?.PDFParse || mod.default;
    const workerPath = resolvePdfWorker();
    if (workerPath && typeof PDFParse.setWorker === "function") {
      PDFParse.setWorker(workerPath);
    }
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const info = await parser.getInfo();
      const textResult = await parser.getText();
      rawText = textResult?.text || "";
      pageCount = info?.total || 0;
    } finally {
      await parser.destroy?.().catch(() => {});
    }
  } catch (pdfParseErr) {
    console.warn("[PdfParser] pdf-parse failed:", (pdfParseErr as Error)?.message);
    try {
      rawText = buffer.toString("utf8");
      const matches = rawText.match(/\/Type[\s]*\/Page[^s]/g);
      pageCount = matches ? matches.length : 1;
    } catch {
      rawText = "";
      pageCount = 0;
    }
  }

  void pageCount;

  // Sanitize: strip control characters that PDF text extraction injects
  // (e.g. U+0002, U+0008 in corrupted Devanagari spans).  These would
  // otherwise trigger silent font fallbacks in the rendered PDF (#11).
  rawText = stripControlChars(rawText);

  const lines = rawText.split(/\r?\n/);
  const blocks: Block[] = [];
  const pageBreakLineNumbers: Set<number> = new Set();

  for (let i = 0; i < lines.length; i++) {
    if (/[\f]/.test(lines[i])) {
      pageBreakLineNumbers.add(i);
    }
  }

  let paraBuffer: string[] = [];
  let currentQuoteBuffer: string[] = [];
  let inQuoteBlock = false;
  let currentListType: "ordered" | "unordered" | null = null;
  let currentListItems: string[] = [];
  // Contents pages list "PART ONE · The Break"-style lines that look exactly
  // like chapter markers — suppress marker detection while inside a TOC.
  let inToc = false;
  let tocLines = 0;

  const flushParagraph = () => {
    if (paraBuffer.length > 0) {
      const joined = trimText(paraBuffer.join(" "));
      if (joined) {
        blocks.push({ type: "paragraph", text: joined });
      }
      paraBuffer = [];
    }
  };

  const flushQuote = () => {
    if (currentQuoteBuffer.length > 0) {
      const joined = trimText(currentQuoteBuffer.join(" "));
      if (joined) {
        blocks.push({ type: "quote", text: joined });
      }
      currentQuoteBuffer = [];
      inQuoteBlock = false;
    }
  };

  const flushList = () => {
    if (currentListItems.length > 0 && currentListType) {
      if (currentListType === "ordered") {
        blocks.push({ type: "list_ordered", items: [...currentListItems] });
      } else {
        blocks.push({ type: "list_unordered", items: [...currentListItems] });
      }
      currentListItems = [];
      currentListType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const isBlank = !trimText(rawLine);
    if (!isBlank && isPageFurniture(rawLine)) continue;
    const prevBlank = i === 0 || !trimText(lines[i - 1]) || isPageFurniture(lines[i - 1]);
    const isContent = (idx: number) => {
      const t = trimText(lines[idx] || "");
      return Boolean(t) && !isPageFurniture(lines[idx]);
    };
    const nextContent = Boolean(
      i < lines.length - 1 &&
        (isContent(i + 1) || (i < lines.length - 2 && isContent(i + 2)))
    );

    if (isBlank) {
      if (inQuoteBlock) flushQuote();
      if (paraBuffer.length > 0) flushParagraph();
      if (currentListType) flushList();
      continue;
    }

    // Contents page: short entry lines pass through as normal text (they're
    // legitimate front matter) but must never become chapter markers.
    if (/^(contents|table of contents)$/i.test(trimText(rawLine))) {
      if (inQuoteBlock) flushQuote();
      if (paraBuffer.length > 0) flushParagraph();
      if (currentListType) flushList();
      blocks.push({ type: "heading_h2", text: "Contents", level: 2 });
      inToc = true;
      tocLines = 0;
      continue;
    }
    if (inToc) {
      tocLines++;
      const t = trimText(rawLine);
      // TOC entries carry decorations: "Part One · The Break", dot leaders
      // "One · Title.....12", or a trailing page number. A bare line means the
      // TOC ended — real dividers like "PART ONE" have no decoration.
      const isTocEntry = /·|\.{3,}|…\s*\d*$|\s\d+\s*$/.test(t);
      if (!isTocEntry || tocLines > 90) inToc = false;
    }

    // Standalone structural markers ("ONE", "PART TWO", "PRACTICE") — checked
    // before headings because the next line often carries the real title and
    // gets consumed into it.
    const peek = (() => {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const t = trimText(lines[j]);
        if (!t || isPageFurniture(lines[j])) continue;
        return t;
      }
      return undefined;
    })();
    const marker = inToc
      ? null
      : detectStandaloneMarker(
          rawLine,
          peek,
          blocks.length === 0 && paraBuffer.length === 0
        );
    if (marker) {
      if (inQuoteBlock) flushQuote();
      if (paraBuffer.length > 0) flushParagraph();
      if (currentListType) flushList();
      blocks.push({ type: "heading_h1", text: marker.title, level: 1 });
      if (marker.consumedNext) {
        // skip forward past blanks/furniture to the title line we consumed
        while (i + 1 < lines.length) {
          i++;
          const t = trimText(lines[i]);
          if (t && !isPageFurniture(lines[i])) break;
        }
      }
      continue;
    }

    const listInfo = detectListMarker(rawLine);
    const headingLevel = detectHeadingLevel(rawLine, prevBlank, nextContent);

    if (listInfo) {
      if (inQuoteBlock) flushQuote();
      if (paraBuffer.length > 0) flushParagraph();
      if (currentListType && currentListType !== listInfo.type) {
        flushList();
      }
      currentListType = listInfo.type;
      currentListItems.push(listInfo.item);
      continue;
    }

    // Headings always end the current list — check before continuation so a
    // heading-like line isn't swallowed into the last list item.
    if (headingLevel) {
      if (inQuoteBlock) flushQuote();
      if (paraBuffer.length > 0) flushParagraph();
      if (currentListType) flushList();
      const blockType =
        headingLevel === 1
          ? "heading_h1"
          : headingLevel === 2
          ? "heading_h2"
          : "heading_h3";
      blocks.push({ type: blockType, text: trimText(rawLine), level: headingLevel });
      continue;
    }

    // When in a list, treat non-blank, non-marker, non-heading lines as
    // continuations of the current item. PDF text extraction strips leading
    // whitespace from wrapped lines, so we can't rely on indentation — the
    // previous approach (requiring /^\s+\S/) caused each wrapped line to flush
    // the list and split every item into a separate single-item list block.
    if (currentListType && !detectQuote(rawLine)) {
      currentListItems[currentListItems.length - 1] = trimText(
        currentListItems[currentListItems.length - 1] + " " + rawLine
      );
      continue;
    }

    if (detectQuote(rawLine)) {
      if (paraBuffer.length > 0) flushParagraph();
      if (currentListType) flushList();
      inQuoteBlock = true;
      currentQuoteBuffer.push(rawLine);
      continue;
    }

    if (inQuoteBlock && /^\s/.test(rawLine) && !listInfo) {
      currentQuoteBuffer.push(rawLine);
      continue;
    }

    if (inQuoteBlock) {
      flushQuote();
    }
    if (currentListType) {
      flushList();
    }

    if (paraBuffer.length === 0) {
      paraBuffer.push(rawLine);
    } else {
      const lastInBuf = paraBuffer[paraBuffer.length - 1];
      if (/[-\u2010\u2011\u2012\u2013]$/.test(lastInBuf)) {
        paraBuffer[paraBuffer.length - 1] = lastInBuf.replace(/[-\u2010\u2011\u2012\u2013]$/, "") + rawLine;
      } else if (/[.!?;:]"?$/.test(lastInBuf)) {
        // Heuristic: a sentence-ending punctuation mark usually means a new
        // paragraph.  But in dense citation/reference sections, line wraps
        // end with periods (initials like "W. L.") and the next line
        // continues the same citation (often starting with "&" or a lowercase
        // word).  Don't break in those cases (#10).
        const nextStarts = trimText(rawLine);
        const prevEnds = lastInBuf.trim();
        const isCitationContinuation =
          // Next line starts with "&" (e.g. "& Berthoud, H.-R. (2022)...")
          /^&/.test(nextStarts) ||
          // Previous line ends with an initial pattern: "W. L." or "F.," etc.
          /\b[A-Z]\.$/.test(prevEnds) ||
          // Previous line ends with a year in parentheses: "(2023),"
          /\(\d{4}\)[,;.]?\s*$/.test(prevEnds);
        if (isCitationContinuation) {
          paraBuffer.push(rawLine);
        } else {
          flushParagraph();
          paraBuffer.push(rawLine);
        }
      } else {
        paraBuffer.push(rawLine);
      }
    }
  }

  if (paraBuffer.length > 0) flushParagraph();
  if (inQuoteBlock) flushQuote();
  if (currentListType) flushList();

  // Merge adjacent same-type list blocks that were split by page breaks.
  // PDF page boundaries inject blank lines (surrounding page-furniture lines
  // that are filtered out), which flush the list mid-sequence. Two adjacent
  // list_ordered/list_unordered blocks with nothing between them are almost
  // always one list torn in half by a page break, not two separate lists.
  const merged: Block[] = [];
  for (const b of blocks) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      (b.type === "list_ordered" || b.type === "list_unordered") &&
      b.type === prev.type &&
      prev.items &&
      b.items
    ) {
      prev.items = [...prev.items, ...b.items];
    } else {
      merged.push(b);
    }
  }

  return { blocks: merged, rawText };
}
