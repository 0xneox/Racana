import type { BookStructureV1, Block } from "../../manuscript/types";
import type { EffectiveSettings } from "../../templates/engine";
import type { RendererOptions } from "../types";

export interface EmbeddedImage {
  fileName: string; // relative to the .typ file directory, e.g. "images/img-0.png"
  buffer: Buffer;
}

function escapeTypst(text: string): string {
  // Escape Typst markup-active characters in body content
  return text
    .replace(/\\/g, '\\\\')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/~/g, '\\~')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/@/g, '\\@')
    .replace(/</g, '\\<');
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
      let typstTable = `#table(\n  columns: ${cols},\n`;
      for (const row of block.rows) {
        for (const cell of row.cells) {
          typstTable += `  [${escapeTypst(cell.text)}],\n`;
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
          images.push({ fileName, buffer: Buffer.from(dataUri[2], "base64") });
          const img = `#image("${fileName}", width: 80%)`;
          const alt = (block.alt || "").trim();
          return alt
            ? `#align(center)[#figure(${img}, caption: [${escapeTypst(alt)}])]\n\n`
            : `#align(center)[${img}]\n\n`;
        } catch {
          // fall through to placeholder on undecodable data
        }
      }
      return `#align(center)[#rect(width: 80%, height: 2in)[Image: ${escapeTypst(block.alt || "Image")}]]\n\n`;
    }
      
    case "caption":
      return `#align(center)[*${escapeTypst(block.text || "")}*]\n\n`;

    default:
      return `${escapeTypst(block.text || "")}\n\n`;
  }
}

export function generateTypstSource(options: RendererOptions): { source: string; images: EmbeddedImage[] } {
  const { structure, settings, templateName } = options;
  const tpl = (templateName || "classic").toLowerCase().replace(/[^a-z]/g, "") || "classic";
  const images: EmbeddedImage[] = [];

  let source = `#import "/src/lib/renderer/typst/templates/${tpl}.typ": project\n\n`;

  // Inject metadata and settings
  source += `#show: project.with(\n`;
  source += `  title: "${escapeTypstString(structure.title || "Untitled")}",\n`;
  source += `  author: "${escapeTypstString(structure.author || "Unknown")}",\n`;
  source += `  trimSize: "${settings.trimSize}",\n`;
  source += `  margins: (inside: ${settings.margins.insideMm}mm, outside: ${settings.margins.outsideMm}mm, top: ${settings.margins.topMm}mm, bottom: ${settings.margins.bottomMm}mm),\n`;
  source += `  bodyFont: "${escapeTypstString(settings.body.fontFamily || "EB Garamond")}",\n`;
  source += `  bodySize: ${settings.body.fontSizePt}pt,\n`;
  source += `  leading: ${settings.body.leadingEm}em,\n`;
  source += `  headingFont: "${escapeTypstString(settings.heading.fontFamily || "EB Garamond")}",\n`;
  source += `  chapterOpenRecto: ${settings.layout.chapterOpenRecto ? "true" : "false"},\n`;
  source += `  runningHeaders: ${settings.layout.runningHeaders ? "true" : "false"},\n`;
  source += `  pageNumbers: "${escapeTypstString(settings.layout.pageNumbersPosition)}",\n`;
  source += `)\n\n`;

  // Front Matter
  if (structure.frontMatter && structure.frontMatter.length > 0) {
    for (const fm of structure.frontMatter) {
      if (fm.title) {
        source += `= ${escapeTypst(fm.title)}\n\n`;
      }
      for (const block of fm.blocks) {
        source += convertBlock(block, images);
      }
      source += `#pagebreak()\n\n`;
    }
  }

  // Chapters
  if (structure.chapters && structure.chapters.length > 0) {
    for (const ch of structure.chapters) {
      // The template handles the chapter open recto logic based on the heading level or explicit pagebreaks
      source += `= ${escapeTypst(ch.title)}\n\n`;
      
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

  // Back Matter
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

  return { source, images };
}
