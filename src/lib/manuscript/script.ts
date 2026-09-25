// Detects which writing system a manuscript is written in so the renderer and
// UI can respond (font fallback, "Hindi detected" chip, beta warnings).

export type DetectedScript =
  | "latin"
  | "devanagari"
  | "bengali"
  | "gurmukhi"
  | "gujarati"
  | "odia"
  | "tamil"
  | "telugu"
  | "kannada"
  | "malayalam"
  | "mixed-indic";

const INDIC_RANGES: { script: Exclude<DetectedScript, "latin" | "mixed-indic">; from: number; to: number }[] = [
  { script: "devanagari", from: 0x0900, to: 0x097f },
  { script: "bengali", from: 0x0980, to: 0x09ff },
  { script: "gurmukhi", from: 0x0a00, to: 0x0a7f },
  { script: "gujarati", from: 0x0a80, to: 0x0aff },
  { script: "odia", from: 0x0b00, to: 0x0b7f },
  { script: "tamil", from: 0x0b80, to: 0x0bff },
  { script: "telugu", from: 0x0c00, to: 0x0c7f },
  { script: "kannada", from: 0x0c80, to: 0x0cff },
  { script: "malayalam", from: 0x0d00, to: 0x0d7f },
];

export const SCRIPT_LABELS: Record<DetectedScript, string> = {
  latin: "English / Latin",
  devanagari: "Hindi · Devanagari",
  bengali: "Bengali",
  gurmukhi: "Punjabi · Gurmukhi",
  gujarati: "Gujarati",
  odia: "Odia",
  tamil: "Tamil",
  telugu: "Telugu",
  kannada: "Kannada",
  malayalam: "Malayalam",
  "mixed-indic": "Multiple Indian scripts",
};

export interface ScriptDetection {
  script: DetectedScript;
  label: string;
  /** Share of letters that are Indic (0–1); >0 means mixed-script content exists. */
  indicRatio: number;
  isIndic: boolean;
}

const MIN_INDIC_CHARS = 30; // below this, Indic presence is likely a quote, not the book's language

export function detectScript(text: string): ScriptDetection {
  const counts = new Map<string, number>();
  let letters = 0;
  let indic = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (/[a-zA-Z]/.test(ch)) {
      letters++;
      continue;
    }
    for (const r of INDIC_RANGES) {
      if (cp >= r.from && cp <= r.to) {
        letters++;
        indic++;
        counts.set(r.script, (counts.get(r.script) || 0) + 1);
        break;
      }
    }
  }

  const indicRatio = letters > 0 ? indic / letters : 0;
  if (indic < MIN_INDIC_CHARS || indicRatio < 0.05) {
    return { script: "latin", label: SCRIPT_LABELS.latin, indicRatio, isIndic: false };
  }

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [top, topCount] = entries[0];
  const second = entries[1];
  const script: DetectedScript =
    second && second[1] > topCount * 0.25 ? "mixed-indic" : (top as DetectedScript);

  return { script, label: SCRIPT_LABELS[script], indicRatio, isIndic: true };
}
