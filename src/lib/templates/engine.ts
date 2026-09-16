import classicDef from "./definitions/classic.json";
import modernDef from "./definitions/modern.json";
import philosophyDef from "./definitions/philosophy.json";
import academicDef from "./definitions/academic.json";
import literaryDef from "./definitions/literary.json";

export type TemplateKey = "classic" | "modern" | "philosophy" | "academic" | "literary";

export const TEMPLATE_KEYS: TemplateKey[] = [
  "classic",
  "modern",
  "philosophy",
  "academic",
  "literary",
];

export interface TrimDefaults {
  trimSize: string;
  marginTopMm: number;
  marginBottomMm: number;
  marginInsideMm: number;
  marginOutsideMm: number;
}

export interface BodySettings {
  fontFamily: string;
  fontSizePt: number;
  leadingEm: number;
  firstLineIndentMm: number;
  paragraphSpacingMm: number;
}

export interface HeadingSettings {
  fontFamily: string;
  h1SizePt: number;
  h2SizePt: number;
  h3SizePt: number;
  spacingBeforeMm: number;
  spacingAfterMm: number;
}

export interface MarginSettings {
  insideMm: number;
  outsideMm: number;
  topMm: number;
  bottomMm: number;
}

export interface LayoutSettings {
  chapterOpenRecto: boolean;
  runningHeaders: boolean;
  runningHeaderFormat: string;
  pageNumbersPosition: "bottom_center" | "outer_header";
  orphanWidowTarget: number;
  bleedMm: number;
  bleedEnabled: boolean;
}

export interface QuoteSettings {
  indentLeftMm: number;
  indentRightMm: number;
  fontSizeAdjustEm: number;
  italic: boolean;
}

export interface FontEmbedEntry {
  family: string;
  file: string;
  weights: number[];
}

export interface TemplateDefinition {
  key: string;
  displayName: string;
  personality: string;
  trimDefaults: TrimDefaults;
  body: BodySettings;
  heading: HeadingSettings;
  margins: MarginSettings;
  layout: LayoutSettings;
  quote: QuoteSettings;
  fontsEmbed: FontEmbedEntry[];
}

export type EffectiveSettings = {
  trimSize: string;
  body: BodySettings;
  heading: HeadingSettings;
  margins: MarginSettings;
  layout: LayoutSettings;
  quote: QuoteSettings;
  fontsEmbed: FontEmbedEntry[];
};

export type BookSettingsFromPrisma = {
  trimSize?: string | null;
  fontBody?: string | null;
  fontHeading?: string | null;
  fontSizePt?: number | null;
  lineHeight?: number | null;
  marginTopMm?: number | null;
  marginBottomMm?: number | null;
  marginInsideMm?: number | null;
  marginOutsideMm?: number | null;
  pageNumbers?: string | null;
  runningHeaders?: boolean | null;
  chapterOpenRecto?: boolean | null;
  bleed?: boolean | null;
  bleedSizeMm?: number | null;
};

const TRIM_SIZE_MAP: Record<string, string> = {
  trim_5x8: "5x8",
  trim_5_5x8_5: "5.5x8.5",
  trim_6x9: "6x9",
  trim_8_5x11: "8.5x11",
};

const REVERSE_TRIM_SIZE_MAP: Record<string, string> = {
  "5x8": "trim_5x8",
  "5.5x8.5": "trim_5_5x8_5",
  "6x9": "trim_6x9",
  "8.5x11": "trim_8_5x11",
};

export function normalizeTrimSize(trim: string | undefined | null): string {
  if (!trim) return "6x9";
  if (TRIM_SIZE_MAP[trim]) return TRIM_SIZE_MAP[trim];
  if (REVERSE_TRIM_SIZE_MAP[trim]) return trim;
  return "6x9";
}

const TEMPLATE_REGISTRY: Record<TemplateKey, TemplateDefinition> = {
  classic: classicDef as unknown as TemplateDefinition,
  modern: modernDef as unknown as TemplateDefinition,
  philosophy: philosophyDef as unknown as TemplateDefinition,
  academic: academicDef as unknown as TemplateDefinition,
  literary: literaryDef as unknown as TemplateDefinition,
};

export function getTemplate(key: TemplateKey | string): TemplateDefinition {
  const templateKey = (key as TemplateKey) || "classic";
  const def = TEMPLATE_REGISTRY[templateKey];
  if (def) return def;
  return TEMPLATE_REGISTRY.classic;
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function isNotNull<T>(v: T | null | undefined): v is T {
  return v !== null && v !== undefined;
}

export function getEffectiveSettings(
  templateDef: TemplateDefinition,
  jobTrimSize: string,
  settingsRow?: Partial<BookSettingsFromPrisma>
): EffectiveSettings {
  const base = deepClone(templateDef);

  const resolvedTrimSize = normalizeTrimSize(jobTrimSize);

  const margins: MarginSettings = {
    insideMm: base.margins.insideMm,
    outsideMm: base.margins.outsideMm,
    topMm: base.margins.topMm,
    bottomMm: base.margins.bottomMm,
  };

  if (resolvedTrimSize && base.trimDefaults.trimSize === resolvedTrimSize) {
    margins.insideMm = base.trimDefaults.marginInsideMm;
    margins.outsideMm = base.trimDefaults.marginOutsideMm;
    margins.topMm = base.trimDefaults.marginTopMm;
    margins.bottomMm = base.trimDefaults.marginBottomMm;
  }

  const body: BodySettings = { ...base.body };
  const heading: HeadingSettings = { ...base.heading };
  const layout: LayoutSettings = { ...base.layout };
  const quote: QuoteSettings = { ...base.quote };
  const fontsEmbed: FontEmbedEntry[] = deepClone(base.fontsEmbed);

  if (settingsRow) {
    if (isNotNull(settingsRow.fontBody)) {
      body.fontFamily = settingsRow.fontBody;
    }
    if (isNotNull(settingsRow.fontHeading)) {
      heading.fontFamily = settingsRow.fontHeading;
    }
    if (isNotNull(settingsRow.fontSizePt)) {
      body.fontSizePt = settingsRow.fontSizePt;
    }
    if (isNotNull(settingsRow.lineHeight)) {
      body.leadingEm = settingsRow.lineHeight;
    }
    if (isNotNull(settingsRow.marginTopMm)) {
      margins.topMm = settingsRow.marginTopMm;
    }
    if (isNotNull(settingsRow.marginBottomMm)) {
      margins.bottomMm = settingsRow.marginBottomMm;
    }
    if (isNotNull(settingsRow.marginInsideMm)) {
      margins.insideMm = settingsRow.marginInsideMm;
    }
    if (isNotNull(settingsRow.marginOutsideMm)) {
      margins.outsideMm = settingsRow.marginOutsideMm;
    }
    if (isNotNull(settingsRow.pageNumbers)) {
      const pos = settingsRow.pageNumbers as LayoutSettings["pageNumbersPosition"];
      if (pos === "bottom_center" || pos === "outer_header") {
        layout.pageNumbersPosition = pos;
      }
    }
    if (isNotNull(settingsRow.runningHeaders)) {
      layout.runningHeaders = settingsRow.runningHeaders;
    }
    if (isNotNull(settingsRow.chapterOpenRecto)) {
      layout.chapterOpenRecto = settingsRow.chapterOpenRecto;
    }
    if (isNotNull(settingsRow.bleed)) {
      layout.bleedEnabled = settingsRow.bleed;
    }
    if (isNotNull(settingsRow.bleedSizeMm)) {
      layout.bleedMm = settingsRow.bleedSizeMm;
    }
  }

  return {
    trimSize: resolvedTrimSize,
    body,
    heading,
    margins,
    layout,
    quote,
    fontsEmbed,
  };
}
