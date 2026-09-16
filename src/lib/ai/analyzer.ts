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

  const chapterRegex = /^chapter\s+([ivxlcdm0-9]+)[\s:.\-—–]*([^\n]*)$/i;
  const chapterMatch = t.match(chapterRegex);
  if (chapterMatch) {
    const num = parseRomanOrArabic(chapterMatch[1]);
    const rest = (chapterMatch[2] || "").trim();
    const title = rest || `Chapter ${chapterMatch[1].toUpperCase()}`;
    return {
      blockIndex: -1,
      chapterNumber: num,
      rawTitle: title,
      headingType: block.type as ChapterHeadingMatch["headingType"],
    };
  }

  const bookRegex = /^book\s+([ivxlcdm0-9]+)[\s:.\-—–]*([^\n]*)$/i;
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
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const m = matchChapterHeading(b);
    if (m) {
      m.blockIndex = i;
      matches.push(m);
    }
  }
  let numCounter = 0;
  let bookCounter = 0;
  for (const m of matches) {
    if (m.isBookLevel) {
      bookCounter++;
      m.chapterNumber = m.chapterNumber || bookCounter;
    } else {
      if (!m.chapterNumber || m.chapterNumber <= 0 || m.chapterNumber > matches.length + 50) {
        numCounter++;
        m.chapterNumber = numCounter;
      } else if (m.chapterNumber > 0) {
        numCounter = Math.max(numCounter, m.chapterNumber);
      }
    }
  }
  return matches;
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
      current = { title: sectionInfo.title, blocks: [] };
      continue;
    }
    if (!current) {
      current = { title: "", blocks: [] };
    }
    current.blocks.push(b);
  }
  flushCurrent();

  return sections.map((s) => ({
    title: s.title,
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
  if (text.includes("bibliography") || text.includes("references")) return "bibliography";
  if (text.includes("appendix")) return "appendix";
  if (text.includes("glossary")) return "glossary";
  if (text.includes("index")) return "index";
  if (text.includes("afterword") || text.includes("epilogue")) return "afterword";
  if (text.includes("notes")) return "endnotes";
  return "back_matter";
}

const DOUBLE_SPACE_REGEX = /[^\n]\s{2,}[^\n]/g;
const REPEATED_WORD_REGEX = /\b(\w+)\s+\1\b/gi;

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
  if (/\b[yoga|sutra|mantra|guru|buddha|dharma|tantra|puja|bhakti|krishna|shiva|vedanta|sanskrit]\b/.test(t) ||
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

function extractTitleAndAuthor(
  blocks: Block[],
  rawText: string,
  filename: string
): { title: string; subtitle?: string; author?: string } {
  let title = "";
  let subtitle: string | undefined;
  let author: string | undefined;

  const nameFromFile = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();

  const firstHeadings = blocks.filter(
    (b) =>
      b.type === "heading_h1" ||
      b.type === "heading_h2" ||
      b.type === "heading_h3" ||
      b.type === "paragraph"
  );

  for (const b of firstHeadings) {
    const txt = (b.text || "").trim();
    if (!txt) continue;
    if (b.type === "heading_h1" || b.type === "heading_h2" || b.type === "heading_h3") {
      if (!title) {
        title = txt;
        continue;
      }
      if (title && !subtitle && txt.length < 120) {
        subtitle = txt;
        break;
      }
    }
    if (!title && b.type === "paragraph" && txt.length < 120 && countWords(txt) <= 10) {
      title = txt;
      continue;
    }
    if (title && !author) {
      const byline = txt.match(/^(?:by|written by|author|authored by)\s+(.+)$/i);
      if (byline) {
        author = byline[1].trim();
        break;
      }
      if (
        b.type === "paragraph" &&
        countWords(txt) >= 1 &&
        countWords(txt) <= 5 &&
        txt.length < 80 &&
        /^[A-Z\u0900-\u097F]/.test(txt) &&
        !/[.!?;:]$/.test(txt) &&
        subtitle === undefined
      ) {
        const looksLikeName = /^[A-Z][a-z]+(?:\s+[A-Z][a-z.]+){0,3}$/.test(txt);
        if (looksLikeName) {
          author = txt;
          break;
        }
      }
    }
    if (title && subtitle && author) break;
  }

  if (!title) {
    title = nameFromFile || "Untitled Manuscript";
  }

  const authorMatch = rawText.match(/^[\s\uFEFF]*(?:by|written by)\s+(.+)$/im);
  if (!author && authorMatch) {
    author = authorMatch[1].trim();
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

  if (isDocx) {
    const result = await parseDocx(buffer);
    blocks = result.blocks;
    rawText = result.rawText;
  } else if (isPdf) {
    const result = await parsePdf(buffer);
    blocks = result.blocks;
    rawText = result.rawText;
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
    const firstH1 = blocks.findIndex((b) => b.type === "heading_h1");
    if (firstH1 >= 0) {
      const fakeMatch: ChapterHeadingMatch = {
        blockIndex: firstH1,
        chapterNumber: 1,
        rawTitle: blocks[firstH1].text || "Untitled",
        headingType: "heading_h1",
      };
      chapterMatches.push(fakeMatch);
      let counter = 1;
      for (let i = firstH1 + 1; i < blocks.length; i++) {
        if (blocks[i].type === "heading_h1") {
          counter++;
          chapterMatches.push({
            blockIndex: i,
            chapterNumber: counter,
            rawTitle: blocks[i].text || `Chapter ${counter}`,
            headingType: "heading_h1",
          });
        }
      }
    } else {
      frontMatterBlocks.push(...blocks);
    }
  }

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
      chapterSegments.push({ match: cm, blocks: segmentBlocks });
    }
  }

  const backMatterBlocks: Block[] = [];
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
    const fmType = detectFrontMatterType(frontMatterBlocks);
    frontMatter.push({
      type: fmType,
      title: fmType.charAt(0).toUpperCase() + fmType.slice(1).replace(/_/g, " "),
      blocks: frontMatterBlocks,
    });
  }

  const chapters: ChapterEntry[] = chapterSegments.map((seg, idx) => {
    const number = seg.match.chapterNumber || idx + 1;
    const sections = splitIntoSections(seg.blocks);
    const wordCount = countBlocksWords(seg.blocks);
    return {
      number,
      title: seg.match.rawTitle || `Chapter ${number}`,
      wordCount,
      sections,
    };
  });

  const backMatter: BackMatterEntry[] = [];
  if (backMatterBlocks.length > 0) {
    const bmType = detectBackMatterType(backMatterBlocks);
    backMatter.push({
      type: bmType,
      title: bmType.charAt(0).toUpperCase() + bmType.slice(1).replace(/_/g, " "),
      blocks: backMatterBlocks,
    });
  }

  const detectedBookType = detectBookType(rawText, blocks, chapters.length);

  let structure: BookStructureV1 = {
    schemaVersion: 1,
    title: meta.title,
    subtitle: meta.subtitle,
    author: meta.author,
    detectedBookType,
    chapterCount: chapters.length,
    estimatedPages,
    warnings: [],
    frontMatter,
    chapters,
    backMatter,
  };

  structure.warnings = generateWarnings(blocks, chapters, estimatedPages);

  try {
    structure = await llmEnhance(structure, rawText);
  } catch {
    // ignore LLM errors; structure is already valid
  }

  return structure;
}
