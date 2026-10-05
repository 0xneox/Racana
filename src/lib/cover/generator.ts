import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

export interface CoverPalette {
  primary: string;
  secondary: string;
  accent: string;
  textColor: string;
  subtextColor: string;
}

export type CoverOrnament = "mandala" | "lotus" | "arch" | "flourish" | "geometric" | "none";
export type CoverFont = "cinzel" | "garamond" | "poppins" | "noto-serif";
export type CoverLayout = "centered" | "editorial" | "heritage" | "minimal";
export type CoverFormat = "ebook" | "paperback";

export interface CoverDesignConfig {
  title: string;
  subtitle?: string;
  author: string;
  tagline?: string;
  genre?: string;
  spineText?: string;
  backBlurb?: string;
  aboutAuthor?: string;
  isbn?: string;
  publisher?: string;
  palette: CoverPalette;
  typography: {
    fontFamily: CoverFont;
    titleCase: "uppercase" | "capitalize" | "normal";
  };
  ornament: CoverOrnament;
  layoutStyle: CoverLayout;
  format: CoverFormat;
  pageCount?: number;
  /** Interior trim size — must match the interior PDF or KDP rejects the cover. */
  trimSize?: CoverTrim;
  /** Interior paper stock; drives the spine width. Defaults to cream. */
  paper?: CoverPaper;
}

export type CoverTrim = "5x8" | "5.5x8.5" | "6x9" | "8.5x11";
export type CoverPaper = "white" | "cream";

/** Artifact type of the stored Kindle/eBook front cover (JPG, 1600×2560). */
export const EBOOK_COVER_ARTIFACT = "cover_ebook_jpg";
/** KDP's recommended eBook cover size (1:1.6). */
export const EBOOK_COVER_PX = { w: 1600, h: 2560 } as const;

export interface CoverPreset {
  id: string;
  name: string;
  description: string;
  palette: CoverPalette;
  ornament: CoverOrnament;
  layoutStyle: CoverLayout;
  typography: {
    fontFamily: CoverFont;
    titleCase: "uppercase" | "capitalize" | "normal";
  };
}

export const COVER_PRESETS: CoverPreset[] = [
  {
    id: "royal-saffron",
    name: "Royal Saffron & Temple Gold",
    description: "Rich Indian crimson and deep saffron with intricate temple gold ornaments.",
    palette: {
      primary: "#7A1C14",
      secondary: "#3E0B06",
      accent: "#E5B138",
      textColor: "#FFF9EB",
      subtextColor: "#E6D3B3",
    },
    ornament: "mandala",
    layoutStyle: "heritage",
    typography: { fontFamily: "cinzel", titleCase: "uppercase" },
  },
  {
    id: "peacock-emerald",
    name: "Peacock Indigo & Teal",
    description: "Vibrant royal peacock blue paired with warm antique gold and sacred lotus.",
    palette: {
      primary: "#0D3B4C",
      secondary: "#061C24",
      accent: "#E6B800",
      textColor: "#F4F7F6",
      subtextColor: "#B8D8D8",
    },
    ornament: "lotus",
    layoutStyle: "centered",
    typography: { fontFamily: "noto-serif", titleCase: "uppercase" },
  },
  {
    id: "classic-obsidian",
    name: "Classic Obsidian & Gold",
    description: "Timeless black and gold luxury aesthetic for philosophy, memoirs, and prestige fiction.",
    palette: {
      primary: "#141414",
      secondary: "#000000",
      accent: "#D4AF37",
      textColor: "#FAF5EE",
      subtextColor: "#A8A29E",
    },
    ornament: "flourish",
    layoutStyle: "editorial",
    typography: { fontFamily: "garamond", titleCase: "uppercase" },
  },
  {
    id: "sunset-terracotta",
    name: "Sunset Terracotta & Amber",
    description: "Earthy, contemporary Indian literary tone, inspired by handcrafted paper and terracotta.",
    palette: {
      primary: "#9C3A1F",
      secondary: "#4A1A0C",
      accent: "#F59E0B",
      textColor: "#FFFBEB",
      subtextColor: "#FED7AA",
    },
    ornament: "mandala",
    layoutStyle: "centered",
    typography: { fontFamily: "cinzel", titleCase: "uppercase" },
  },
  {
    id: "minimalist-ivory",
    name: "Minimalist Ivory & Slate",
    description: "High-contrast clean literary style, ideal for contemporary poetry and essays.",
    palette: {
      primary: "#F8F5EE",
      secondary: "#E8E2D5",
      accent: "#9A3412",
      textColor: "#1C1917",
      subtextColor: "#57534E",
    },
    ornament: "geometric",
    layoutStyle: "minimal",
    typography: { fontFamily: "garamond", titleCase: "capitalize" },
  },
  {
    id: "midnight-philosophy",
    name: "Midnight Sapphire & Silver",
    description: "Deep celestial blue with silver-gold arch motif, perfect for academic and spiritual works.",
    palette: {
      primary: "#0F1E36",
      secondary: "#050B14",
      accent: "#60A5FA",
      textColor: "#F0F9FF",
      subtextColor: "#94A3B8",
    },
    ornament: "arch",
    layoutStyle: "heritage",
    typography: { fontFamily: "cinzel", titleCase: "uppercase" },
  },
];

// ---------------------------------------------------------------------------
// Design-space geometry
// ---------------------------------------------------------------------------
// Layouts are authored in an 800×1280 design panel (exactly the 1:1.6 eBook
// cover).  A paperback panel has a different aspect — trim + 0.125″ bleed on
// the outer edge horizontally, + 0.125″ top and bottom — so its design height
// is derived from the physical size and the authored layout is scaled
// uniformly into it.  Nothing is ever stretched on export.
export const PANEL_W = 800;
export const COVER_H = 1280;
const BLEED_IN = 0.125;

export const TRIM_SIZES_IN: Record<CoverTrim, { w: number; h: number }> = {
  "5x8": { w: 5, h: 8 },
  "5.5x8.5": { w: 5.5, h: 8.5 },
  "6x9": { w: 6, h: 9 },
  "8.5x11": { w: 8.5, h: 11 },
};

// KDP paperback paper thickness per page (black-ink interiors).
export const PAPER_IN_PER_PAGE: Record<CoverPaper, number> = {
  white: 0.002252,
  cream: 0.0025,
};

/** KDP only allows spine text on books with more than 79 pages. */
export const KDP_SPINE_TEXT_MIN_PAGES = 80;

export function trimOf(config: Pick<CoverDesignConfig, "trimSize">): { w: number; h: number } {
  return TRIM_SIZES_IN[config.trimSize || "6x9"] || TRIM_SIZES_IN["6x9"];
}

export function spineWidthInches(pageCount: number, paper: CoverPaper = "cream"): number {
  const pages = Math.max(24, Math.min(828, Math.round(pageCount || 100)));
  return pages * (PAPER_IN_PER_PAGE[paper] ?? PAPER_IN_PER_PAGE.cream);
}

export interface CoverGeometry {
  /** Design height of one panel. */
  panelH: number;
  pxPerIn: number;
  spinePx: number;
  /** Total design width. */
  width: number;
  /** Uniform scale + horizontal inset that maps the 800×1280 layout into a panel. */
  scale: number;
  insetX: number;
  /** Horizontal bleed in design px (outer edge of each panel). */
  bleedPx: number;
}

export function coverGeometry(config: CoverDesignConfig): CoverGeometry {
  if (config.format !== "paperback") {
    return { panelH: COVER_H, pxPerIn: PANEL_W / 6, spinePx: 0, width: PANEL_W, scale: 1, insetX: 0, bleedPx: 0 };
  }
  const trim = trimOf(config);
  const pxPerIn = PANEL_W / (trim.w + BLEED_IN);
  const panelH = Math.round((trim.h + 2 * BLEED_IN) * pxPerIn);
  const spinePx = spineWidthInches(config.pageCount || 100, config.paper) * pxPerIn;
  const scale = panelH / COVER_H;
  return {
    panelH,
    pxPerIn,
    spinePx,
    width: PANEL_W * 2 + spinePx,
    scale,
    insetX: (PANEL_W - PANEL_W * scale) / 2,
    bleedPx: BLEED_IN * pxPerIn,
  };
}

export function spineWidthPx(pageCount: number, config?: Partial<CoverDesignConfig>): number {
  return coverGeometry({ ...(config as CoverDesignConfig), format: "paperback", pageCount }).spinePx;
}

// Physical cover dimensions in inches (KDP full-wrap spec: bleed on all four
// outer edges, none at the spine folds).
export function coverPhysicalSize(config: CoverDesignConfig): { wIn: number; hIn: number } {
  if (config.format === "paperback") {
    const trim = trimOf(config);
    const spine = spineWidthInches(config.pageCount || 100, config.paper);
    return { wIn: 2 * (trim.w + BLEED_IN) + spine, hIn: trim.h + 2 * BLEED_IN };
  }
  return { wIn: 6, hIn: 9.6 }; // ebook front, 1:1.6 ratio
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

export function formatTitleText(text: string, titleCase: "uppercase" | "capitalize" | "normal"): string {
  if (titleCase === "uppercase") return text.toUpperCase();
  if (titleCase === "capitalize") {
    return text.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return text;
}

// Word-wrap a paragraph into lines of at most `maxChars` characters.
export function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Split a title into balanced lines so long titles never overflow.
function splitTitle(title: string): string[] {
  const t = title.trim();
  if (t.length <= 22) return [t];
  const words = t.split(/\s+/);
  const lines: string[] = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && `${cur} ${w}`.length > 22 && lines.length < 3) {
      lines.push(w);
    } else {
      lines[lines.length - 1] = cur ? `${cur} ${w}` : w;
    }
  }
  return lines.filter(Boolean);
}

// Shrink the title size until its longest line fits inside maxWidth.
// Serif capitals advance ≈ 0.62em including letter-spacing.
function fitTitleSize(lines: string[], baseSize: number, maxWidth: number): number {
  const longest = Math.max(...lines.map((l) => l.length), 1);
  return Math.max(20, Math.min(baseSize, Math.floor(maxWidth / (longest * 0.62))));
}

// Render a wrapped paragraph as <text> with <tspan> lines (unlike
// foreignObject this rasterizes correctly in every SVG→PNG/PDF pipeline).
function svgParagraph(
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  fill: string,
  fontStack: string,
  anchor: "start" | "middle" = "start",
  fontWeight = 400
): string {
  const maxChars = Math.max(10, Math.floor(maxWidth / (fontSize * 0.48)));
  const lines = wrapText(text, maxChars);
  const spans = lines
    .map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lineHeight}">${escapeXml(l)}</tspan>`)
    .join("");
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${fontStack}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${fill}">${spans}</text>`;
}

// ---------------------------------------------------------------------------
// Ornaments
// ---------------------------------------------------------------------------

export function getOrnamentSvg(ornament: CoverOrnament, accentColor: string): string {
  switch (ornament) {
    case "mandala":
      return `
      <g data-ornament="mandala" stroke="${accentColor}" fill="none" stroke-width="1.8" opacity="0.85">
        <circle cx="400" cy="560" r="140" stroke-dasharray="3,3" />
        <circle cx="400" cy="560" r="110" />
        <circle cx="400" cy="560" r="75" stroke-dasharray="4,4" />
        <circle cx="400" cy="560" r="40" />
        <circle cx="400" cy="560" r="10" fill="${accentColor}" />
        ${Array.from({ length: 12 })
          .map((_, i) => {
            const rot = i * 30;
            return `<path d="M 400 485 C 415 515 425 540 400 560 C 375 540 385 515 400 485 Z" transform="rotate(${rot} 400 560)" />`;
          })
          .join("\n        ")}
        ${Array.from({ length: 8 })
          .map((_, i) => {
            const rot = i * 45 + 15;
            return `<path d="M 400 440 C 430 480 440 520 400 560 C 360 520 370 480 400 440 Z" transform="rotate(${rot} 400 560)" />`;
          })
          .join("\n        ")}
      </g>`;
    case "lotus":
      return `
      <g stroke="${accentColor}" fill="none" stroke-width="2" opacity="0.9">
        <path d="M 400 480 C 425 520 425 560 400 580 C 375 560 375 520 400 480 Z" fill="${accentColor}" fill-opacity="0.1" />
        <path d="M 400 500 C 445 525 450 565 400 585 C 390 565 385 535 400 500 Z" />
        <path d="M 400 500 C 355 525 350 565 400 585 C 410 565 415 535 400 500 Z" />
        <path d="M 400 520 C 470 540 480 575 400 590 C 375 575 360 550 400 520 Z" />
        <path d="M 400 520 C 330 540 320 575 400 590 C 425 575 440 550 400 520 Z" />
        <path d="M 330 595 Q 400 615 470 595 Q 400 605 330 595 Z" fill="${accentColor}" />
      </g>`;
    case "arch":
      return `
      <g stroke="${accentColor}" fill="none" stroke-width="2" opacity="0.85">
        <path d="M 220 700 L 220 520 Q 220 440 310 400 Q 355 380 400 340 Q 445 380 490 400 Q 580 440 580 520 L 580 700" />
        <path d="M 235 700 L 235 525 Q 235 450 320 415 Q 360 395 400 360 Q 440 395 480 415 Q 565 450 565 525 L 565 700" stroke-width="1" stroke-dasharray="4,4" />
        <circle cx="400" cy="330" r="5" fill="${accentColor}" />
      </g>`;
    case "flourish":
      return `
      <g stroke="${accentColor}" fill="none" stroke-width="2" opacity="0.85">
        <path d="M 260 560 Q 330 540 385 560 Q 400 565 415 560 Q 470 540 540 560" />
        <circle cx="400" cy="560" r="4" fill="${accentColor}" />
        <circle cx="380" cy="560" r="2.5" fill="${accentColor}" />
        <circle cx="420" cy="560" r="2.5" fill="${accentColor}" />
        <path d="M 320 560 C 340 580 370 580 400 568 C 430 580 460 580 480 560" stroke-width="1.2" />
      </g>`;
    case "geometric":
      return `
      <g stroke="${accentColor}" fill="none" stroke-width="1.5" opacity="0.75">
        <rect x="250" y="440" width="300" height="240" transform="rotate(45 400 560)" />
        <rect x="270" y="460" width="260" height="200" transform="rotate(45 400 560)" stroke-dasharray="3,3" />
        <circle cx="400" cy="560" r="6" fill="${accentColor}" />
      </g>`;
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Layouts — the interior of one 800×1280 front panel
// ---------------------------------------------------------------------------

// Ornaments are authored around (400,560); reposition them for layouts.
function ornamentAt(ornamentSvg: string, cx: number, cy: number, scale = 1, opacity = 1): string {
  if (!ornamentSvg) return "";
  const tx = cx - 400 * scale;
  const ty = cy - 560 * scale;
  return `<g transform="translate(${tx} ${ty}) scale(${scale})" opacity="${opacity}">${ornamentSvg}</g>`;
}

function titleLinesSvg(
  lines: string[],
  cx: number,
  baseY: number,
  size: number,
  fill: string,
  fontStack: string,
  anchor: "start" | "middle" = "middle",
  letterSpacing = 2
): string {
  return lines
    .map(
      (l, i) =>
        `<text x="${cx}" y="${baseY + i * (size + 12)}" text-anchor="${anchor}" font-family="${fontStack}" font-size="${size}" font-weight="700" fill="${fill}" letter-spacing="${letterSpacing}">${escapeXml(
          l
        )}</text>`
    )
    .join("\n  ");
}

function frontCoverBlocks(config: CoverDesignConfig, fontStack: string): string {
  const p = config.palette;
  const formattedTitle = formatTitleText(config.title, config.typography.titleCase);
  const lines = splitTitle(formattedTitle);
  const ornament = config.ornament !== "none" ? getOrnamentSvg(config.ornament, p.accent) : "";
  const pub = escapeXml((config.publisher || "RACANA · PUBLISHING").toUpperCase());

  if (config.layoutStyle === "editorial") {
    const size = fitTitleSize(lines, 52, 610);
    const subY = 330 + lines.length * (size + 12) + 28;
    return `
  <rect x="60" y="60" width="680" height="1160" fill="none" stroke="${p.accent}" stroke-width="1" opacity="0.4" />
  ${
    config.tagline
      ? `<text x="90" y="140" font-family="${fontStack}" font-size="13" font-weight="600" fill="${p.accent}" letter-spacing="4" text-transform="uppercase">${escapeXml(
          config.tagline.toUpperCase()
        )}</text>`
      : ""
  }
  <line x1="90" y1="170" x2="250" y2="170" stroke="${p.accent}" stroke-width="2.5" />
  ${titleLinesSvg(lines, 90, 330, size, p.textColor, fontStack, "start", 1)}
  ${
    config.subtitle
      ? `<text x="90" y="${subY}" font-family="${fontStack}" font-size="20" font-style="italic" fill="${p.subtextColor}" letter-spacing="1">${escapeXml(
          config.subtitle
        )}</text>`
      : ""
  }
  ${ornamentAt(ornament, 560, 830, 0.55, 0.55)}
  <text x="90" y="1060" font-family="${fontStack}" font-size="11" fill="${p.accent}" letter-spacing="3" text-transform="uppercase">A WORK BY</text>
  ${svgParagraph(config.author.toUpperCase(), 90, 1105, 620, 26, 34, p.textColor, fontStack, "start", 600)}
  <text x="710" y="1220" text-anchor="end" font-family="${fontStack}" font-size="11" fill="${p.accent}" letter-spacing="4" opacity="0.8">${pub}</text>`;
  }

  if (config.layoutStyle === "minimal") {
    const size = fitTitleSize(lines, 46, 620);
    const subY = 660 + lines.length * (size + 12) + 20;
    return `
  ${
    config.tagline
      ? `<text x="400" y="110" text-anchor="middle" font-family="${fontStack}" font-size="12" font-weight="600" fill="${p.accent}" letter-spacing="6" text-transform="uppercase">${escapeXml(
          config.tagline.toUpperCase()
        )}</text>`
      : ""
  }
  ${ornamentAt(ornament, 400, 430, 0.5, 0.5)}
  <line x1="310" y1="600" x2="490" y2="600" stroke="${p.accent}" stroke-width="1.5" />
  ${titleLinesSvg(lines, 400, 660, size, p.textColor, fontStack)}
  ${
    config.subtitle
      ? `<text x="400" y="${subY}" text-anchor="middle" font-family="${fontStack}" font-size="17" font-style="italic" fill="${p.subtextColor}" letter-spacing="1">${escapeXml(
          config.subtitle
        )}</text>`
      : ""
  }
  <text x="400" y="1150" text-anchor="middle" font-family="${fontStack}" font-size="20" font-weight="600" fill="${p.textColor}" letter-spacing="4" text-transform="uppercase">${escapeXml(
    config.author.toUpperCase()
  )}</text>
  <text x="400" y="1215" text-anchor="middle" font-family="${fontStack}" font-size="10" fill="${p.accent}" letter-spacing="5" opacity="0.75">${pub}</text>`;
  }

  if (config.layoutStyle === "heritage") {
    const size = fitTitleSize(lines, 44, 620);
    const subY = 305 + lines.length * (size + 12) + 18;
    return `
  <rect x="36" y="36" width="728" height="1208" fill="none" stroke="${p.accent}" stroke-width="3" opacity="0.9" />
  <rect x="46" y="46" width="708" height="1188" fill="none" stroke="${p.accent}" stroke-width="1" stroke-dasharray="6,4" opacity="0.6" />
  <rect x="62" y="62" width="676" height="1156" fill="none" stroke="${p.accent}" stroke-width="1" opacity="0.7" />
  <path d="M 36 66 L 66 36 M 764 66 L 734 36 M 36 1214 L 66 1244 M 764 1214 L 734 1244" stroke="${p.accent}" stroke-width="2.5" />
  <circle cx="36" cy="36" r="5" fill="${p.accent}" /><circle cx="764" cy="36" r="5" fill="${p.accent}" />
  <circle cx="36" cy="1244" r="5" fill="${p.accent}" /><circle cx="764" cy="1244" r="5" fill="${p.accent}" />
  ${
    config.tagline
      ? `<line x1="150" y1="138" x2="290" y2="138" stroke="${p.accent}" stroke-width="1" /><line x1="510" y1="138" x2="650" y2="138" stroke="${p.accent}" stroke-width="1" /><text x="400" y="143" text-anchor="middle" font-family="${fontStack}" font-size="13" font-weight="600" fill="${p.accent}" letter-spacing="4" text-transform="uppercase">${escapeXml(
          config.tagline.toUpperCase()
        )}</text>`
      : ""
  }
  ${titleLinesSvg(lines, 400, 305, size, p.textColor, fontStack)}
  ${
    config.subtitle
      ? `<text x="400" y="${subY}" text-anchor="middle" font-family="${fontStack}" font-size="17" font-style="italic" fill="${p.subtextColor}" letter-spacing="1.5">${escapeXml(
          config.subtitle
        )}</text>`
      : ""
  }
  ${ornamentAt(ornament, 400, 620, 0.85)}
  <rect x="240" y="1040" width="320" height="72" fill="none" stroke="${p.accent}" stroke-width="1.5" rx="4" />
  <text x="400" y="1065" text-anchor="middle" font-family="${fontStack}" font-size="10" fill="${p.accent}" letter-spacing="3" text-transform="uppercase">A WORK BY</text>
  <text x="400" y="1095" text-anchor="middle" font-family="${fontStack}" font-size="20" font-weight="600" fill="${p.textColor}" letter-spacing="2" text-transform="uppercase">${escapeXml(
    config.author.toUpperCase()
  )}</text>
  <text x="400" y="1190" text-anchor="middle" font-family="${fontStack}" font-size="11" fill="${p.accent}" letter-spacing="4" opacity="0.85">${pub}</text>`;
  }

  // centered (default)
  const size = fitTitleSize(lines, 42, 640);
  const titleBaseY = config.subtitle ? 230 : 270;
  const subY = titleBaseY + lines.length * (size + 12) + 20;
  return `
  <rect x="36" y="36" width="728" height="1208" fill="none" stroke="${p.accent}" stroke-width="2.5" opacity="0.85" />
  <rect x="46" y="46" width="708" height="1188" fill="none" stroke="${p.accent}" stroke-width="1" stroke-dasharray="6,4" opacity="0.6" />
  <path d="M 36 66 L 66 36 M 764 66 L 734 36 M 36 1214 L 66 1244 M 764 1214 L 734 1244" stroke="${p.accent}" stroke-width="2" />
  ${
    config.tagline
      ? `<text x="400" y="140" text-anchor="middle" font-family="${fontStack}" font-size="14" font-weight="600" fill="${p.accent}" letter-spacing="4" text-transform="uppercase">${escapeXml(
          config.tagline.toUpperCase()
        )}</text>`
      : ""
  }
  ${titleLinesSvg(lines, 400, titleBaseY, size, p.textColor, fontStack)}
  ${
    config.subtitle
      ? `<text x="400" y="${subY}" text-anchor="middle" font-family="${fontStack}" font-size="18" font-style="italic" fill="${p.subtextColor}" letter-spacing="1.5">${escapeXml(
          config.subtitle
        )}</text>`
      : ""
  }
  ${ornamentAt(ornament, 400, 560)}
  <text x="400" y="1040" text-anchor="middle" font-family="${fontStack}" font-size="12" fill="${p.accent}" letter-spacing="3" text-transform="uppercase">A WORK BY</text>
  <text x="400" y="1090" text-anchor="middle" font-family="${fontStack}" font-size="28" font-weight="600" fill="${p.textColor}" letter-spacing="3" text-transform="uppercase">${escapeXml(
    config.author.toUpperCase()
  )}</text>
  <text x="400" y="1170" text-anchor="middle" font-family="${fontStack}" font-size="11" fill="${p.accent}" letter-spacing="4" opacity="0.8">${pub}</text>`;
}

// ---------------------------------------------------------------------------
// Back cover + guides
// ---------------------------------------------------------------------------

function backCoverBlocks(config: CoverDesignConfig, fontStack: string): string {
  const p = config.palette;
  const blurb =
    config.backBlurb ||
    "An extraordinary literary achievement that blends timeless wisdom, vivid characters, and thought-provoking storytelling. Crafted with meticulous typography and devotion to the written word.";
  const blurbLines = wrapText(blurb, 78).slice(0, 14);
  const blurbEndY = 240 + blurbLines.length * 27;

  const blurbText = `<text x="80" y="240" font-family="${fontStack}" font-size="16" fill="${p.textColor}">${blurbLines
    .map((l, i) => `<tspan x="80" dy="${i === 0 ? 0 : 27}">${escapeXml(l)}</tspan>`)
    .join("")}</text>`;

  const authorY = Math.max(blurbEndY + 50, 720);
  const authorBlock = config.aboutAuthor
    ? `<text x="80" y="${authorY}" font-family="${fontStack}" font-size="13" font-weight="700" fill="${p.accent}" letter-spacing="2">ABOUT THE AUTHOR</text>
  ${svgParagraph(config.aboutAuthor, 80, authorY + 28, 620, 14, 22, p.subtextColor, fontStack)}`
    : "";

  return `
  <rect x="36" y="36" width="728" height="1208" fill="none" stroke="${p.accent}" stroke-width="1.5" opacity="0.7" />
  <text x="400" y="140" text-anchor="middle" font-family="${fontStack}" font-size="20" font-weight="700" fill="${p.accent}" letter-spacing="3">PRAISE &amp; OVERVIEW</text>
  <line x1="320" y1="160" x2="480" y2="160" stroke="${p.accent}" stroke-width="1.5" />
  ${blurbText}
  ${authorBlock}
  <rect x="480" y="1060" width="220" height="110" fill="#FFFFFF" rx="4" />
  <text x="590" y="1120" text-anchor="middle" font-family="monospace" font-size="12" fill="#000000">ISBN ${escapeXml(
    config.isbn || "978-93-000000-0-0"
  )}</text>
  <rect x="500" y="1075" width="180" height="30" fill="none" stroke="#000000" stroke-width="1" stroke-dasharray="2,2" />`;
}

// Print-production overlay: bleed edge, trim line, safe zone, spine folds.
function guidesSvg(isPaperback: boolean, g: CoverGeometry): string {
  const H = g.panelH;
  const W = g.width;
  // eBooks have no bleed; the safe zone is a comfortable reading inset.
  const bleed = isPaperback ? g.bleedPx : 0;
  const safe = bleed + 0.25 * g.pxPerIn;
  const spineIn = g.spinePx / g.pxPerIn;

  const spineGuides = isPaperback
    ? `
  <line x1="${PANEL_W}" y1="0" x2="${PANEL_W}" y2="${H}" stroke="#DC2626" stroke-width="1.5" stroke-dasharray="10,5" />
  <line x1="${PANEL_W + g.spinePx}" y1="0" x2="${PANEL_W + g.spinePx}" y2="${H}" stroke="#DC2626" stroke-width="1.5" stroke-dasharray="10,5" />
  <text x="${PANEL_W + g.spinePx / 2}" y="30" text-anchor="middle" font-family="sans-serif" font-size="13" font-weight="700" fill="#DC2626">SPINE ${spineIn.toFixed(
        3
      )}″</text>`
    : "";

  return `<g font-family="sans-serif">
  ${isPaperback ? `<rect x="${bleed}" y="${bleed}" width="${W - bleed * 2}" height="${H - bleed * 2}" fill="none" stroke="#DC2626" stroke-width="1" stroke-dasharray="6,4" opacity="0.8" />` : ""}
  <rect x="${safe}" y="${safe}" width="${W - safe * 2}" height="${H - safe * 2}" fill="none" stroke="#2563EB" stroke-width="1" stroke-dasharray="2,4" opacity="0.7" />
  ${spineGuides}
  ${isPaperback ? `<text x="${bleed + 6}" y="${H - bleed - 8}" font-size="11" fill="#DC2626" font-weight="600">TRIM</text>` : ""}
  <text x="${safe + 6}" y="${H - safe - 8}" font-size="11" fill="#2563EB" font-weight="600">SAFE ZONE</text>
</g>`;
}

// ---------------------------------------------------------------------------
// SVG renderer — single source of truth for preview AND export
// ---------------------------------------------------------------------------

export interface CoverSvgOptions {
  showGuides?: boolean;
}

export function generateCoverSvg(config: CoverDesignConfig, opts: CoverSvgOptions = {}): string {
  const isPaperback = config.format === "paperback";
  const g = coverGeometry(config);
  const { spinePx, width, panelH: H } = g;

  const fontStack =
    config.typography.fontFamily === "cinzel"
      ? "'Cinzel', 'Times New Roman', serif"
      : config.typography.fontFamily === "noto-serif"
        ? "'Noto Serif', 'Noto Serif Devanagari', 'Georgia', serif"
        : config.typography.fontFamily === "garamond"
          ? "'EB Garamond', 'Garamond', serif"
          : "'Poppins', 'Helvetica Neue', sans-serif";

  const front = frontCoverBlocks(config, fontStack);
  const guides = opts.showGuides ? guidesSvg(isPaperback, g) : "";

  if (!isPaperback) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PANEL_W} ${COVER_H}" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${config.palette.primary}" />
      <stop offset="100%" stop-color="${config.palette.secondary}" />
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#000000" stop-opacity="0.55" />
    </radialGradient>
  </defs>
  <rect width="${PANEL_W}" height="${COVER_H}" fill="url(#bgGrad)" />
  <rect width="${PANEL_W}" height="${COVER_H}" fill="url(#vignette)" />
  ${front}
  ${guides}
</svg>`;
  }

  // Layouts are centred on the trim area, not the bleed-inclusive panel: the
  // back panel's bleed is on its left edge, the front panel's on its right.
  const fit = (dx: number) => `translate(${g.insetX + dx} 0) scale(${g.scale})`;
  // KDP: spine text only above 79 pages, with ≥0.0625″ clearance each side.
  const spineFont = Math.min(16, (spinePx - 0.125 * g.pxPerIn) * 0.75);
  const showSpineText = (config.pageCount || 100) >= KDP_SPINE_TEXT_MIN_PAGES && spineFont >= 6;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${H}" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${config.palette.primary}" />
      <stop offset="100%" stop-color="${config.palette.secondary}" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${H}" fill="url(#bgGrad)" />
  <g transform="${fit(g.bleedPx / 2)}">
    ${backCoverBlocks(config, fontStack)}
  </g>
  <rect x="${PANEL_W}" y="0" width="${spinePx}" height="${H}" fill="#000000" opacity="0.18" />
  ${
    showSpineText
      ? `<g transform="translate(${PANEL_W + spinePx / 2}, ${H / 2}) rotate(90)">
    <text x="0" y="${(spineFont * 0.35).toFixed(2)}" text-anchor="middle" font-family="${fontStack}" font-size="${spineFont.toFixed(2)}" font-weight="700" fill="${config.palette.textColor}" letter-spacing="2">${escapeXml(
      config.spineText || formatTitleText(config.title, config.typography.titleCase)
    )} · ${escapeXml(config.author)}</text>
  </g>`
      : ""
  }
  <g transform="translate(${PANEL_W + spinePx}, 0)">
    <g transform="${fit(-g.bleedPx / 2)}">
      ${front}
    </g>
  </g>
  ${guides}
</svg>`;
}

// ---------------------------------------------------------------------------
// Server-side PDF fallback (used only when the client can't rasterize —
// the Cover Studio produces pixel-identical PDFs from the SVG itself).
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  if (clean.length === 3) {
    const r = ((num >> 8) & 15) * 17;
    const g = ((num >> 4) & 15) * 17;
    const b = (num & 15) * 17;
    return { r: r / 255, g: g / 255, b: b / 255 };
  }
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return { r: r / 255, g: g / 255, b: b / 255 };
}

export async function generateCoverPdf(config: CoverDesignConfig): Promise<Buffer> {
  const doc = await PDFDocument.create();

  // Print points: 1 inch = 72 points. Trim + 0.125″ bleed on the outer edges.
  const isPaperback = config.format === "paperback";
  const trim = trimOf(config);
  const spinePt = isPaperback ? spineWidthInches(config.pageCount || 100, config.paper) * 72 : 0;
  const panelPt = isPaperback ? (trim.w + BLEED_IN) * 72 : 6 * 72;
  const coverWidth = isPaperback ? panelPt * 2 + spinePt : panelPt;
  const coverHeight = isPaperback ? (trim.h + 2 * BLEED_IN) * 72 : 9.6 * 72;

  const page = doc.addPage([coverWidth, coverHeight]);

  const pColor = hexToRgb(config.palette.primary);
  const sColor = hexToRgb(config.palette.secondary);
  const aColor = hexToRgb(config.palette.accent);
  const tColor = hexToRgb(config.palette.textColor);
  const stColor = hexToRgb(config.palette.subtextColor);

  // Vertical gradient approximation (two stacked rects)
  page.drawRectangle({ x: 0, y: coverHeight / 2, width: coverWidth, height: coverHeight / 2, color: rgb(pColor.r, pColor.g, pColor.b) });
  page.drawRectangle({ x: 0, y: 0, width: coverWidth, height: coverHeight / 2, color: rgb(sColor.r, sColor.g, sColor.b) });

  const fontBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const fontNormal = await doc.embedFont(StandardFonts.TimesRoman);

  const frontOriginX = isPaperback ? panelPt + spinePt : 0;
  const centerX = frontOriginX + panelPt / 2;

  page.drawRectangle({
    x: frontOriginX + 18,
    y: 18,
    width: panelPt - 36,
    height: coverHeight - 36,
    borderColor: rgb(aColor.r, aColor.g, aColor.b),
    borderWidth: 1.5,
  });

  const formattedTitle = formatTitleText(config.title, config.typography.titleCase);
  const titleLines = splitTitle(formattedTitle);
  let y = coverHeight - 160;
  for (const line of titleLines) {
    let size = 26;
    while (size > 14 && fontBold.widthOfTextAtSize(line, size) > panelPt - 90) size -= 1;
    const w = fontBold.widthOfTextAtSize(line, size);
    page.drawText(line, { x: centerX - w / 2, y, size, font: fontBold, color: rgb(tColor.r, tColor.g, tColor.b) });
    y -= size + 8;
  }

  if (config.subtitle) {
    const size = 12;
    const w = fontNormal.widthOfTextAtSize(config.subtitle, size);
    page.drawText(config.subtitle, { x: centerX - w / 2, y: y - 6, size, font: fontNormal, color: rgb(stColor.r, stColor.g, stColor.b) });
  }

  if (config.tagline) {
    const size = 8;
    const tag = config.tagline.toUpperCase();
    const w = fontNormal.widthOfTextAtSize(tag, size);
    page.drawText(tag, { x: centerX - w / 2, y: coverHeight - 90, size, font: fontNormal, color: rgb(aColor.r, aColor.g, aColor.b) });
  }

  const authorUpper = config.author.toUpperCase();
  const authorSize = 16;
  const authorW = fontBold.widthOfTextAtSize(authorUpper, authorSize);
  page.drawText(authorUpper, { x: centerX - authorW / 2, y: 100, size: authorSize, font: fontBold, color: rgb(tColor.r, tColor.g, tColor.b) });

  const pubText = (config.publisher || "RACANA PUBLISHING").toUpperCase();
  const pubW = fontNormal.widthOfTextAtSize(pubText, 8);
  page.drawText(pubText, { x: centerX - pubW / 2, y: 50, size: 8, font: fontNormal, color: rgb(aColor.r, aColor.g, aColor.b) });

  if (isPaperback) {
    if ((config.pageCount || 100) >= KDP_SPINE_TEXT_MIN_PAGES) {
      const spineLabel = `${config.spineText || formattedTitle}  •  ${config.author}`;
      const spineTextW = fontBold.widthOfTextAtSize(spineLabel, 10);
      page.drawText(spineLabel, {
        x: panelPt + spinePt / 2 - 4,
        y: (coverHeight - spineTextW) / 2,
        size: 10,
        font: fontBold,
        color: rgb(tColor.r, tColor.g, tColor.b),
        rotate: degrees(90),
      });
    }

    // Back cover: frame, wrapped blurb, barcode box
    page.drawRectangle({ x: 18, y: 18, width: panelPt - 36, height: coverHeight - 36, borderColor: rgb(aColor.r, aColor.g, aColor.b), borderWidth: 1 });
    const blurbTitle = "ABOUT THIS BOOK";
    const blurbTitleW = fontBold.widthOfTextAtSize(blurbTitle, 12);
    page.drawText(blurbTitle, { x: (panelPt - blurbTitleW) / 2, y: coverHeight - 80, size: 12, font: fontBold, color: rgb(aColor.r, aColor.g, aColor.b) });

    const blurb = config.backBlurb || "";
    const blurbLines = wrapText(blurb, 85).slice(0, 20);
    let blurbY = coverHeight - 120;
    for (const line of blurbLines) {
      page.drawText(line, { x: 40, y: blurbY, size: 10.5, font: fontNormal, color: rgb(tColor.r, tColor.g, tColor.b) });
      blurbY -= 15;
    }

    page.drawRectangle({ x: panelPt - 200, y: 50, width: 150, height: 70, color: rgb(1, 1, 1) });
    page.drawText(`ISBN ${config.isbn || "978-93-0000-00-0"}`, { x: panelPt - 190, y: 60, size: 8, font: fontNormal, color: rgb(0, 0, 0) });
  }

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}

function escapeXml(unsafe: string = ""): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
