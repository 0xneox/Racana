// Client-side cover export: the SVG preview is the single source of truth.
// We rasterize it to PNG at 300 DPI (with the selected font embedded as
// data URIs so canvas rendering matches the on-screen preview exactly),
// then wrap the PNG in a correctly-sized PDF via pdf-lib.

import { PDFDocument } from "pdf-lib";
import {
  generateCoverSvg,
  coverPhysicalSize,
  spineWidthPx,
  PANEL_W,
  COVER_H,
  type CoverDesignConfig,
  type CoverFont,
} from "./generator";

const GOOGLE_FONT_QUERY: Record<CoverFont, string> = {
  cinzel: "Cinzel:wght@400;600;700",
  garamond: "EB+Garamond:ital,wght@0,400;0,700;1,400",
  "noto-serif": "Noto+Serif:ital,wght@0,400;0,700;1,400",
  poppins: "Poppins:ital,wght@0,400;0,600;0,700;1,400",
};

// Indic scripts present in the cover text need their Noto family embedded too —
// the Latin subsets alone would rasterize Devanagari/Tamil as tofu boxes.
const INDIC_FONT_RANGES: { family: string; from: number; to: number }[] = [
  { family: "Noto Serif Devanagari", from: 0x0900, to: 0x097f },
  { family: "Noto Serif Bengali", from: 0x0980, to: 0x09ff },
  { family: "Noto Serif Gurmukhi", from: 0x0a00, to: 0x0a7f },
  { family: "Noto Serif Gujarati", from: 0x0a80, to: 0x0aff },
  { family: "Noto Serif Oriya", from: 0x0b00, to: 0x0b7f },
  { family: "Noto Serif Tamil", from: 0x0b80, to: 0x0bff },
  { family: "Noto Serif Telugu", from: 0x0c00, to: 0x0c7f },
  { family: "Noto Serif Kannada", from: 0x0c80, to: 0x0cff },
  { family: "Noto Serif Malayalam", from: 0x0d00, to: 0x0d7f },
];

function neededIndicFamilies(config: CoverDesignConfig): string[] {
  const text = [
    config.title,
    config.subtitle,
    config.author,
    config.tagline,
    config.spineText,
    config.backBlurb,
    config.aboutAuthor,
    config.publisher,
  ]
    .filter(Boolean)
    .join(" ");
  const needed = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    for (const r of INDIC_FONT_RANGES) {
      if (cp >= r.from && cp <= r.to) {
        needed.add(r.family);
        break;
      }
    }
  }
  return [...needed];
}

const fontCssCache = new Map<string, Promise<string>>();

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// Fetch a Google family's font files and inline them as @font-face data URIs.
// `latinOnly` restricts to the Latin subset (keeps the payload small for the
// four display faces); script-specific families embed all their subsets.
async function embeddedFontCss(query: string, latinOnly: boolean): Promise<string> {
  const cacheKey = `${query}|${latinOnly ? "latin" : "all"}`;
  const cached = fontCssCache.get(cacheKey);
  if (cached) return cached;

  const promise = (async () => {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${query}&display=swap`
    ).then((r) => r.text());

    const blocks = (css.match(/@font-face\s*\{[^}]+\}/g) || []).filter(
      (b) => !latinOnly || b.includes("U+0000-00FF")
    );
    const urls = new Set<string>();
    for (const b of blocks) {
      const m = b.match(/url\((https:[^)]+)\)/);
      if (m) urls.add(m[1]);
    }

    const dataUris = new Map<string, string>();
    await Promise.all(
      [...urls].map(async (u) => {
        const buf = await fetch(u).then((r) => r.arrayBuffer());
        dataUris.set(u, `data:font/woff2;base64,${arrayBufferToBase64(buf)}`);
      })
    );

    return blocks
      .map((b) => b.replace(/url\((https:[^)]+)\)/, (m, u: string) => `url(${dataUris.get(u)})`))
      .join("\n");
  })();

  fontCssCache.set(cacheKey, promise);
  return promise;
}

// SVG with its fonts embedded — safe to rasterize in an isolated Image context.
export async function exportReadySvg(config: CoverDesignConfig): Promise<string> {
  let svg = generateCoverSvg(config, { showGuides: false });
  try {
    const indic = neededIndicFamilies(config);
    const cssParts = await Promise.all([
      embeddedFontCss(GOOGLE_FONT_QUERY[config.typography.fontFamily], true),
      ...indic.map((f) =>
        embeddedFontCss(`${f.replace(/ /g, "+")}:wght@400;700`, false)
      ),
    ]);
    const css = cssParts.filter(Boolean).join("\n");
    if (!css) return svg;
    // Append needed Indic families to every font stack so fallback stays
    // inside the embedded set rather than hitting unavailable system fonts.
    for (const fam of indic) {
      svg = svg.replace(/font-family="([^"]*)"/g, (m, list: string) =>
        list.includes(fam) ? m : `font-family="${list}, '${fam}'"`
      );
    }
    return svg.replace("<defs>", `<defs>\n    <style>${css}</style>`);
  } catch {
    return svg; // offline / fetch failure — export with system font fallback
  }
}

function svgPixelSize(config: CoverDesignConfig): { w: number; h: number } {
  const svgW =
    config.format === "paperback"
      ? PANEL_W * 2 + spineWidthPx(config.pageCount || 100)
      : PANEL_W;
  const { wIn, hIn } = coverPhysicalSize(config);
  const scale = (wIn * 300) / svgW;
  return { w: Math.round(svgW * scale), h: Math.round(hIn * 300) };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to rasterize cover preview"));
    img.src = url;
  });
}

// Rasterize the cover SVG to a PNG blob at print resolution (300 DPI).
export async function coverPngBlob(config: CoverDesignConfig): Promise<Blob> {
  const svg = await exportReadySvg(config);
  const { w, h } = svgPixelSize(config);

  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG export failed"))), "image/png")
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Wrap the PNG in a PDF whose page matches the physical cover size exactly.
export async function coverPdfBlob(config: CoverDesignConfig): Promise<Blob> {
  const png = await coverPngBlob(config);
  const pngBytes = await png.arrayBuffer();
  const { wIn, hIn } = coverPhysicalSize(config);

  const doc = await PDFDocument.create();
  const page = doc.addPage([wIn * 72, hIn * 72]);
  const embedded = await doc.embedPng(pngBytes);
  page.drawImage(embedded, { x: 0, y: 0, width: wIn * 72, height: hIn * 72 });
  const bytes = await doc.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function coverFilename(config: CoverDesignConfig, ext: string): string {
  const slug = config.title.replace(/[^a-zA-Z0-9_-]/g, "_") || "cover";
  const tag = config.format === "paperback" ? "paperback_wrap" : "ebook_front";
  return `${slug}_${tag}.${ext}`;
}
