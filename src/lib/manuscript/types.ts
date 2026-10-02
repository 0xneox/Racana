export type BlockType =
  | "paragraph"
  /** Paragraph rendered without a first-line indent (after headings/breaks). */
  | "noindent_paragraph"
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
  | "bibliography"
  | "toc_entry"
  | "practice_box"
  | "epigraph"
  | "copyright"
  | "title_page";

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
  /** For toc_entry: the page number target. */
  page?: number;
  /** For practice_box: the subtitle/label under the "PRACTICE" eyebrow. */
  label?: string;
  /** For practice_box: the inner blocks (list items, paragraphs). */
  blocks?: Block[];
  /** For epigraph: the attribution line. */
  attribution?: string;
  /**
   * Detection confidence (0–1) for blocks produced by heuristics —
   * run-in subheads, glued-heading splits. Values < 0.8 surface in the
   * preflight report so a human can eyeball them before generating.
   */
  confidence?: number;
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
  /** Heading level of the section title (2 = `==`, 3 = `===`). Default 2. */
  level?: number;
  blocks: Block[];
}

export interface ChapterEntry {
  number: number;
  title: string;
  wordCount: number;
  sections: ChapterSection[];
  /**
   * Structural kind: a regular "chapter" opener, a level-0 "part" divider
   * (own recto page, no folio), or back-matter "matter".
   * Absent on structures produced by older analyzers — treated as "chapter".
   */
  kind?: "chapter" | "part" | "matter";
  /**
   * Eyebrow label rendered above the opener in small caps
   * (e.g. "PART ONE", "CHAPTER SEVEN").
   */
  label?: string;
  /** Part subtitle rendered in italic under the part title. */
  subtitle?: string;
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
  /** Dominant writing system detected in the manuscript (e.g. "devanagari"). */
  detectedScript?: string;
  /** Human-readable label, e.g. "Hindi · Devanagari". */
  scriptLabel?: string;
  warnings: WarningItem[];
  frontMatter: FrontMatterEntry[];
  chapters: ChapterEntry[];
  backMatter: BackMatterEntry[];
  /**
   * Pre-generation review checklist. Computed by runPreflight() and stored on
   * the structure so the UI can show "Looks right / Fix it" before rendering.
   */
  preflight?: PreflightReport;
}

export interface PreflightItem {
  id: string;
  /** Short checklist label, e.g. "Unbalanced quotation marks". */
  label: string;
  /** "ok" = looks right; "check" = flagged for the author to review. */
  status: "ok" | "check";
  /** What was found, including a snippet when relevant. */
  detail?: string;
  /** Block / chapter reference to help the author locate it. */
  location?: string;
}

export interface PreflightReport {
  items: PreflightItem[];
  /** Estimated interior page count. */
  estimatedPages: number;
  /** KDP spine text requires >= 79 pages. */
  belowKdpSpineMinimum: boolean;
  /** True when the estimated count is not a multiple of 2 — needs a blank pad. */
  needsEndPad: boolean;
}

export interface DocxParseResult {
  blocks: Block[];
  rawText: string;
  /** Human-readable log of mechanical text repairs applied during parsing. */
  fixes?: string[];
}

export interface PdfParseResult {
  blocks: Block[];
  rawText: string;
}
