import type { BookStructureV1 } from "../manuscript/types";
import type { EffectiveSettings } from "../templates/engine";

export interface RendererOptions {
  jobId: string;
  structure: BookStructureV1;
  settings: EffectiveSettings;
  templateName: string;
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
