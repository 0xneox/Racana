import * as mammothNs from "mammoth";
const mammoth: typeof mammothNs =
  (mammothNs as unknown as { default?: typeof mammothNs }).default || mammothNs;
import JSZip from "jszip";
import type { Block, DocxParseResult, TableRow } from "./types";

function trimText(s: string): string {
  return s.replace(/^\s+|\s+$/g, "");
}

function isHeadingStyle(styleName: string | undefined): number | null {
  if (!styleName) return null;
  const lower = styleName.toLowerCase();
  if (lower === "heading 1" || lower === "heading1" || lower === "title") return 1;
  if (lower === "heading 2" || lower === "heading2") return 2;
  if (lower === "heading 3" || lower === "heading3") return 3;
  return null;
}

function isQuoteStyle(styleName: string | undefined): boolean {
  if (!styleName) return false;
  const lower = styleName.toLowerCase();
  return (
    lower === "quote" ||
    lower === "blockquote" ||
    lower === "intense quote" ||
    lower === "intense_quote" ||
    lower.includes("quote")
  );
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

// Lenient fallback when mammoth's strict XML parser rejects a file (e.g. malformed
// attributes from non-Word generators). Reads word/document.xml directly and
// walks paragraphs + heading styles by regex — no full XML parse required.
async function parseDocxFallback(buffer: Buffer): Promise<DocxParseResult> {
  const zip = await JSZip.loadAsync(buffer);
  const docFile = zip.file("word/document.xml");
  if (!docFile) throw new Error("word/document.xml not found in DOCX package");
  const xml = await docFile.async("string");

  const blocks: Block[] = [];
  const rawParts: string[] = [];

  const paraRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let m: RegExpExecArray | null;
  while ((m = paraRegex.exec(xml)) !== null) {
    const para = m[1];

    const styleMatch = para.match(/<w:pStyle\s+w:val="([^"]+)"/);
    const styleVal = (styleMatch?.[1] || "").toLowerCase();

    const textParts: string[] = [];
    const textRegex = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = textRegex.exec(para)) !== null) {
      textParts.push(decodeXmlEntities(tm[1]));
    }
    const text = trimText(textParts.join("").replace(/\u00AD/g, ""));
    if (!text) continue;

    rawParts.push(text);

    const headingLevel = isHeadingStyle(styleVal);
    if (headingLevel) {
      blocks.push({
        type: headingLevel === 1 ? "heading_h1" : headingLevel === 2 ? "heading_h2" : "heading_h3",
        text,
        level: headingLevel,
      });
    } else if (styleVal.includes("quote")) {
      blocks.push({ type: "quote", text });
    } else {
      blocks.push({ type: "paragraph", text });
    }
  }

  if (blocks.length === 0) {
    throw new Error("DOCX fallback extraction produced no readable text");
  }

  return { blocks: repairLineBreakSplits(blocks), rawText: rawParts.join("\n\n") };
}

// De-hyphenate within a single block's text.  DOCX line breaks inside a
// paragraph can leave patterns like "cer-\ntain" in the extracted text —
// a regular hyphen (U+002D) followed by a newline.  When Typst renders this,
// it shows "cer tain" (the hyphen becomes a space at the line break).
// This function joins such patterns back into "certain".
function deHyphenateText(text: string): string {
  return text.replace(/([a-zA-Z])-\n([a-zA-Z])/g, "$1$2");
}

// Post-process the blocks list to repair words that mammoth split across
// line breaks.  DOCX files (especially from Word's automatic hyphenation or
// manual line breaks within paragraphs) arrive as separate <p> tags per
// line, so a word like "understanding" hyphenated at a line end becomes two
// blocks: "under-" and "standing".  Without this repair, the rendered book
// shows "under standing" — a broken word with a space where the hyphen was.
//
// Rules:
//   1. De-hyphenation: if block N ends with "-" and block N+1 starts with a
//      lowercase letter, join them (remove the hyphen).  "under-" + "standing"
//      -> "understanding".
//   2. Continuation join: if block N+1 is a very short fragment (<= 5 chars)
//      starting with a lowercase letter, and block N doesn't end with
//      sentence-ending punctuation, join them with no extra space.  This
//      catches "Be" + "gin" -> "Begin" where the split had no hyphen.
function repairLineBreakSplits(blocks: Block[]): Block[] {
  // First, de-hyphenate within each block's own text.
  for (const b of blocks) {
    if (b.text) b.text = deHyphenateText(b.text);
    if (b.items) b.items = b.items.map((it) => deHyphenateText(it));
    if (b.rows) {
      for (const r of b.rows) {
        for (const c of r.cells) c.text = deHyphenateText(c.text);
      }
    }
  }

  if (blocks.length < 2) return blocks;
  const result: Block[] = [blocks[0]];
  for (let i = 1; i < blocks.length; i++) {
    const prev = result[result.length - 1];
    const curr = blocks[i];

    // Only merge paragraph-into-paragraph or heading-into-heading (don't
    // merge a paragraph into a list, table, image, etc.).
    const isTextBlock = (b: Block) =>
      b.type === "paragraph" || b.type === "heading_h1" || b.type === "heading_h2" || b.type === "heading_h3";
    if (!isTextBlock(prev) || !isTextBlock(curr)) {
      result.push(curr);
      continue;
    }

    const prevText = (prev.text || "").trim();
    const currText = (curr.text || "").trim();

    // Rule 1: de-hyphenation — prev ends with "-", curr starts lowercase
    if (prevText.endsWith("-") && /^[a-z]/.test(currText)) {
      const joined = prevText.slice(0, -1) + currText;
      prev.text = joined;
      continue;
    }

    // Rule 2: continuation — curr is a very short fragment starting with
    // lowercase, prev doesn't end with sentence punctuation.  This catches
    // splits like "Be" + "gin" where no hyphen was present.
    if (
      currText.length <= 5 &&
      /^[a-z]/.test(currText) &&
      !/[.!?;:"]$/.test(prevText) &&
      prevText.length > 0
    ) {
      prev.text = prevText + currText;
      continue;
    }

    result.push(curr);
  }
  return result;
}

export async function parseDocx(buffer: Buffer): Promise<DocxParseResult> {
  try {
    return await parseDocxWithMammoth(buffer);
  } catch (err) {
    console.warn(
      "[DocxParser] mammoth parse failed, trying lenient OOXML fallback:",
      (err as Error)?.message
    );
    return parseDocxFallback(buffer);
  }
}

async function parseDocxWithMammoth(buffer: Buffer): Promise<DocxParseResult> {
  const rawResult = await mammoth.extractRawText({ buffer });
  const htmlResult = await mammoth.convertToHtml(
    { buffer },
    {
      includeDefaultStyleMap: true,
      convertImage: mammoth.images.imgElement((image) => {
        const imgAny = image as unknown as { altText?: string; alt?: string };
        return image.read("base64").then((imageBuffer) => {
          return {
            src: `data:${image.contentType};base64,${imageBuffer}`,
            alt: imgAny.altText || imgAny.alt || "",
          };
        });
      }),
    }
  );

  const rawText = rawResult.value;
  const blocks: Block[] = [];

  const styleMap = (htmlResult.messages || [])
    .filter((m: { type?: string }) => m.type === "style")
    .reduce<Record<string, string>>((acc, msg) => {
      const msgAny = msg as unknown as { name?: string; styleName?: string };
      if (msgAny.name && msgAny.styleName) {
        acc[msgAny.name] = msgAny.styleName;
      }
      return acc;
    }, {});

  type ParsedNode =
    | { kind: "heading"; level: number; text: string }
    | { kind: "paragraph"; text: string; isQuote: boolean }
    | { kind: "ordered_list"; items: string[] }
    | { kind: "unordered_list"; items: string[] }
    | { kind: "table"; rows: TableRow[] }
    | { kind: "image"; alt: string; src: string }
    | { kind: "footnote"; identifier: string; text: string }
    | { kind: "raw"; text: string };

  const nodes: ParsedNode[] = [];

  const htmlContent = htmlResult.value;

  // Include inline formatting tags (strong, em, b, i, a, etc.) so they are
  // recognised as tags and stripped — their text content flows into the
  // paragraph buffer as plain text.  Without this, `<strong>...</strong>`
  // and `<em>...</em>` from mammoth's HTML output leak through as literal
  // strings into the rendered book.
  const tagRegex = /<(ol|ul|table|blockquote|h[1-6]|p|img|li|tr|td|th|div|span|strong|em|b|i|a|sup|sub|u|s|mark|code|font|br)[^>]*>|<\/(ol|ul|table|blockquote|h[1-6]|p|img|li|tr|td|th|div|span|strong|em|b|i|a|sup|sub|u|s|mark|code|font)>/gi;

  let lastIndex = 0;
  const tagStack: { tag: string; attrs: Record<string, string> }[] = [];
  let listType: "ol" | "ul" | null = null;
  let listItems: string[] = [];
  let inTable = false;
  let tableRows: TableRow[] = [];
  let currentRowCells: { text: string }[] = [];
  let inBlockquote = false;
  let paragraphBuffer = "";
  let paragraphIsQuote = false;
  let paragraphHeadingLevel: number | null = null;

  const flushParagraph = () => {
    const text = trimText(paragraphBuffer);
    if (text.length > 0) {
      if (paragraphHeadingLevel !== null) {
        nodes.push({ kind: "heading", level: paragraphHeadingLevel, text });
      } else if (paragraphIsQuote || inBlockquote) {
        nodes.push({ kind: "paragraph", text, isQuote: true });
      } else {
        nodes.push({ kind: "paragraph", text, isQuote: false });
      }
    }
    paragraphBuffer = "";
    paragraphIsQuote = false;
    paragraphHeadingLevel = null;
  };

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      if (listType === "ol") {
        nodes.push({ kind: "ordered_list", items: [...listItems] });
      } else {
        nodes.push({ kind: "unordered_list", items: [...listItems] });
      }
      listItems = [];
      listType = null;
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      nodes.push({ kind: "table", rows: [...tableRows] });
      tableRows = [];
    }
    inTable = false;
  };

  const flushRow = () => {
    if (currentRowCells.length > 0) {
      tableRows.push({ cells: [...currentRowCells] });
      currentRowCells = [];
    }
  };

  const matches = Array.from(htmlContent.matchAll(tagRegex));
  for (const match of matches) {
    const fullTag = match[0];
    const matchIndex = match.index as number;
    const textBefore = htmlContent.slice(lastIndex, matchIndex);
    if (textBefore) {
      const decoded = textBefore
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/<br\s*\/?>/gi, "\n")
        // Strip soft hyphens (U+00AD) — DOCX uses them for automatic
        // hyphenation; when mammoth preserves them, words like "under\u00AD
        // standing" render as "under standing" (split at the invisible
        // hyphen). Removing them joins the word back together.
        .replace(/\u00AD/g, "");
      if (currentRowCells.length > 0) {
        currentRowCells[currentRowCells.length - 1].text += decoded;
      } else if (listItems.length > 0 && listType) {
        listItems[listItems.length - 1] += decoded;
      } else {
        paragraphBuffer += decoded;
      }
    }
    lastIndex = matchIndex + fullTag.length;

    const isClose = fullTag.startsWith("</");
    if (isClose) {
      const tagName = (match[2] || "").toLowerCase();
      if (tagName === "p" || tagName === "div") {
        flushParagraph();
      } else if (tagName === "ol" || tagName === "ul") {
        flushList();
      } else if (tagName === "li") {
        if (listItems.length > 0) {
          listItems[listItems.length - 1] = trimText(listItems[listItems.length - 1]);
        }
      } else if (tagName === "table") {
        flushRow();
        flushTable();
      } else if (tagName === "tr") {
        flushRow();
      } else if (tagName === "td" || tagName === "th") {
        if (currentRowCells.length > 0) {
          currentRowCells[currentRowCells.length - 1].text = trimText(
            currentRowCells[currentRowCells.length - 1].text
          );
        }
      } else if (tagName === "blockquote") {
        inBlockquote = false;
        flushParagraph();
      } else if (tagName.startsWith("h")) {
        flushParagraph();
      }
      for (let i = tagStack.length - 1; i >= 0; i--) {
        if (tagStack[i].tag === tagName) {
          tagStack.splice(i, 1);
          break;
        }
      }
    } else {
      const tagName = (match[1] || "").toLowerCase();
      const attrs: Record<string, string> = {};
      const attrRegex = /(\w[\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
      let attrMatch: RegExpExecArray | null;
      while ((attrMatch = attrRegex.exec(fullTag)) !== null) {
        attrs[attrMatch[1].toLowerCase()] = attrMatch[2] ?? attrMatch[3] ?? "";
      }
      // Don't push self-closing tags onto the stack — they have no closing
      // tag and would accumulate forever.
      if (tagName !== "br" && tagName !== "img") {
        tagStack.push({ tag: tagName, attrs });
      }

      const styleAttr = (attrs.style || attrs["data-style"] || "").toLowerCase();
      const classAttr = attrs.class || "";
      const styleName = styleMap[tagName] || classAttr;
      const combinedStyle = `${styleName} ${styleAttr}`.toLowerCase();

      if (tagName === "h1" || tagName === "h2" || tagName === "h3" || tagName === "h4" || tagName === "h5" || tagName === "h6") {
        flushParagraph();
        const levelNum = parseInt(tagName.charAt(1), 10);
        paragraphHeadingLevel = Math.min(levelNum, 3) as 1 | 2 | 3;
      } else if (combinedStyle.includes("heading")) {
        const headingLevel = isHeadingStyle(styleName) ?? isHeadingStyle(combinedStyle);
        if (headingLevel) {
          flushParagraph();
          paragraphHeadingLevel = headingLevel as 1 | 2 | 3;
        }
      }

      if (tagName === "blockquote" || isQuoteStyle(styleName) || combinedStyle.includes("quote")) {
        inBlockquote = true;
        paragraphIsQuote = true;
      }

      if (tagName === "ol") {
        flushList();
        listType = "ol";
      } else if (tagName === "ul") {
        flushList();
        listType = "ul";
      } else if (tagName === "li") {
        if (listType) {
          listItems.push("");
        }
      }

      if (tagName === "table") {
        flushParagraph();
        flushList();
        inTable = true;
        tableRows = [];
      } else if (tagName === "tr") {
        flushRow();
      } else if (tagName === "td" || tagName === "th") {
        currentRowCells.push({ text: "" });
      }

      if (tagName === "img") {
        flushParagraph();
        nodes.push({
          kind: "image",
          alt: attrs.alt || "",
          src: attrs.src || "",
        });
      }

      // <br> is a self-closing inline break — insert a newline into whatever
      // buffer is currently active (paragraph, list item, or table cell).
      if (tagName === "br") {
        if (currentRowCells.length > 0) {
          currentRowCells[currentRowCells.length - 1].text += "\n";
        } else if (listItems.length > 0 && listType) {
          listItems[listItems.length - 1] += "\n";
        } else {
          paragraphBuffer += "\n";
        }
      }
    }
  }

  const tail = htmlContent.slice(lastIndex);
  if (tail) {
    const decoded = tail
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/\u00AD/g, "");
    paragraphBuffer += decoded;
  }

  flushParagraph();
  flushList();
  flushRow();
  flushTable();

  for (const node of nodes) {
    switch (node.kind) {
      case "heading": {
        const blockType =
          node.level === 1
            ? "heading_h1"
            : node.level === 2
            ? "heading_h2"
            : "heading_h3";
        blocks.push({ type: blockType, text: node.text, level: node.level });
        break;
      }
      case "paragraph": {
        if (node.isQuote) {
          blocks.push({ type: "quote", text: node.text });
        } else {
          blocks.push({ type: "paragraph", text: node.text });
        }
        break;
      }
      case "ordered_list": {
        blocks.push({ type: "list_ordered", items: node.items });
        break;
      }
      case "unordered_list": {
        blocks.push({ type: "list_unordered", items: node.items });
        break;
      }
      case "table": {
        blocks.push({ type: "table", rows: node.rows });
        break;
      }
      case "image": {
        blocks.push({ type: "image", alt: node.alt, src: node.src });
        break;
      }
      case "footnote": {
        blocks.push({
          type: "footnote",
          identifier: node.identifier,
          text: node.text,
        });
        break;
      }
      case "raw": {
        const t = trimText(node.text);
        if (t) blocks.push({ type: "paragraph", text: t });
        break;
      }
    }
  }

  if (blocks.length === 0 && rawText) {
    const paragraphs = rawText.split(/\n\s*\n/).map(trimText).filter(Boolean);
    for (const p of paragraphs) {
      blocks.push({ type: "paragraph", text: p });
    }
  }

  return { blocks: repairLineBreakSplits(blocks), rawText };
}
