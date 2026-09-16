import type { Block, PdfParseResult } from "./types";

function trimText(s: string): string {
  return s.replace(/^\s+|\s+$/g, "");
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

  const chapterMatch = trimmed.match(/^chapter\s+([ivxlcdm\d]+)/i);
  if (chapterMatch) return 1;

  const bookMatch = trimmed.match(/^book\s+([ivxlcdm\d]+)/i);
  if (bookMatch) return 1;

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
    const pdfParseModule = await import("pdf-parse");
    const parsePdfFn =
      (pdfParseModule as unknown as { default?: typeof pdfParseModule }).default ||
      pdfParseModule;
    const result = await (parsePdfFn as unknown as (b: Buffer) => Promise<{ text: string; numpages: number }>)(buffer);
    rawText = result.text;
    pageCount = result.numpages || 0;
  } catch {
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
    const prevBlank = i === 0 || !trimText(lines[i - 1]);
    const nextContent = Boolean(
      i < lines.length - 1 &&
        (trimText(lines[i + 1]) ||
          (i < lines.length - 2 && trimText(lines[i + 2])))
    );

    if (isBlank) {
      if (inQuoteBlock) flushQuote();
      if (paraBuffer.length > 0) flushParagraph();
      if (currentListType) flushList();
      continue;
    }

    const listInfo = detectListMarker(rawLine);
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

    if (currentListType && /^\s+\S/.test(rawLine) && !detectHeadingLevel(rawLine, prevBlank, nextContent)) {
      currentListItems[currentListItems.length - 1] = trimText(
        currentListItems[currentListItems.length - 1] + " " + rawLine
      );
      continue;
    }

    const headingLevel = detectHeadingLevel(rawLine, prevBlank, nextContent);
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
        flushParagraph();
        paraBuffer.push(rawLine);
      } else {
        paraBuffer.push(rawLine);
      }
    }
  }

  if (paraBuffer.length > 0) flushParagraph();
  if (inQuoteBlock) flushQuote();
  if (currentListType) flushList();

  return { blocks, rawText };
}
