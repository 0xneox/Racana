import type { BookStructureV1 } from "../manuscript/types";
import type { EffectiveSettings } from "../templates/engine";

export interface RendererOptions {
  jobId: string;
  structure: BookStructureV1;
  settings: EffectiveSettings;
  templateName: string;
}

export interface EmbeddedImage {
  fileName: string; // relative to the .typ file directory, e.g. "images/img-0.png"
  buffer: Buffer;
}

export interface QAIssue {
  code: string;
  level: "info" | "warning" | "error";
  description: string;
}

export interface QAReportResult {
  passed: boolean;
  score: number;
  pageCount: number;
  issues: QAIssue[];
}
