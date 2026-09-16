export type BlockType =
  | "paragraph"
  | "heading_h1"
  | "heading_h2"
  | "heading_h3"
  | "quote"
  | "list_ordered"
  | "list_unordered"
  | "table"
  | "footnote"
  | "image"
  | "caption"
  | "reference"
  | "bibliography";

export interface TableCell {
  text: string;
}

export interface TableRow {
  cells: TableCell[];
}

export interface Block {
  type: BlockType;
  text?: string;
  level?: number;
  items?: string[];
  rows?: TableRow[];
  alt?: string;
  src?: string;
  identifier?: string;
}

export interface WarningItem {
  code: string;
  level: "info" | "warning" | "error";
  message: string;
  page?: number;
}

export interface FrontMatterEntry {
  type: string;
  title: string;
  blocks: Block[];
}

export interface ChapterSection {
  title: string;
  blocks: Block[];
}

export interface ChapterEntry {
  number: number;
  title: string;
  wordCount: number;
  sections: ChapterSection[];
}

export interface BackMatterEntry {
  type: string;
  title: string;
  blocks: Block[];
}

export interface BookStructureV1 {
  schemaVersion: 1;
  title: string;
  subtitle?: string;
  author?: string;
  detectedBookType?:
    | "novel"
    | "philosophy"
    | "academic"
    | "business"
    | "memoir"
    | "spiritual"
    | "childrens"
    | "other";
  chapterCount: number;
  estimatedPages: number;
  warnings: WarningItem[];
  frontMatter: FrontMatterEntry[];
  chapters: ChapterEntry[];
  backMatter: BackMatterEntry[];
}

export interface DocxParseResult {
  blocks: Block[];
  rawText: string;
}

export interface PdfParseResult {
  blocks: Block[];
  rawText: string;
}
