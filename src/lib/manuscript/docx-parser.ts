import * as mammothNs from "mammoth";
const mammoth: typeof mammothNs =
  (mammothNs as unknown as { default?: typeof mammothNs }).default || mammothNs;
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

export async function parseDocx(buffer: Buffer): Promise<DocxParseResult> {
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

  const tagRegex = /<(ol|ul|table|blockquote|h[1-6]|p|img|li|tr|td|th|div|span)[^>]*>|<\/(ol|ul|table|blockquote|h[1-6]|p|img|li|tr|td|th|div|span)>/gi;

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
        .replace(/<br\s*\/?>/gi, "\n");
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
      tagStack.push({ tag: tagName, attrs });

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
      .replace(/<br\s*\/?>/gi, "\n");
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

  return { blocks, rawText };
}
