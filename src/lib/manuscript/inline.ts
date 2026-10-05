// Inline formatting travels through the pipeline as Unicode private-use
// markers embedded in a block's `rich` string.  `text` always stays plain so
// the analyzer, preflight and AI passes never see markup; renderers prefer
// `rich` only while it still matches `text` (see resolveRich).

export const MARK = {
  B_ON: "\uE000",
  B_OFF: "\uE001",
  I_ON: "\uE002",
  I_OFF: "\uE003",
  NOTE_OPEN: "\uE004",
  NOTE_CLOSE: "\uE005",
} as const;

const NOTE_REF = /\uE004([^\uE005]*)\uE005/g;
const ANY_MARK = /[\uE000-\uE005]/;

export function noteRef(id: string): string {
  return `${MARK.NOTE_OPEN}${id}${MARK.NOTE_CLOSE}`;
}

export function hasInline(s: string | undefined | null): boolean {
  return !!s && ANY_MARK.test(s);
}

export function stripInline(s: string | undefined | null): string {
  return (s || "").replace(NOTE_REF, "").replace(/[\uE000-\uE005]/g, "");
}

export function noteIds(s: string | undefined | null): string[] {
  return Array.from((s || "").matchAll(NOTE_REF), (m) => m[1]);
}

export type InlineToken =
  | { kind: "text"; text: string; bold: boolean; italic: boolean }
  | { kind: "note"; id: string };

export function tokenizeInline(s: string): InlineToken[] {
  const out: InlineToken[] = [];
  let bold = 0;
  let italic = 0;
  let buf = "";
  const flush = () => {
    if (!buf) return;
    const prev = out[out.length - 1];
    if (prev?.kind === "text" && prev.bold === bold > 0 && prev.italic === italic > 0) prev.text += buf;
    else out.push({ kind: "text", text: buf, bold: bold > 0, italic: italic > 0 });
    buf = "";
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    switch (ch) {
      case MARK.B_ON: flush(); bold++; break;
      case MARK.B_OFF: flush(); bold = Math.max(0, bold - 1); break;
      case MARK.I_ON: flush(); italic++; break;
      case MARK.I_OFF: flush(); italic = Math.max(0, italic - 1); break;
      case MARK.NOTE_OPEN: {
        const end = s.indexOf(MARK.NOTE_CLOSE, i);
        if (end < 0) break;
        flush();
        out.push({ kind: "note", id: s.slice(i + 1, end) });
        i = end;
        break;
      }
      case MARK.NOTE_CLOSE: break;
      default: buf += ch;
    }
  }
  flush();
  return out;
}

// Re-serialise tokens into a canonical rich string: balanced, no empty or
// redundant spans, whitespace-only spans left unstyled.
function serialize(tokens: InlineToken[]): string {
  return tokens
    .map((t) => {
      if (t.kind === "note") return noteRef(t.id);
      if (!t.text.trim() || (!t.bold && !t.italic)) return t.text;
      let inner = t.text;
      if (t.italic) inner = `${MARK.I_ON}${inner}${MARK.I_OFF}`;
      if (t.bold) inner = `${MARK.B_ON}${inner}${MARK.B_OFF}`;
      return inner;
    })
    .join("");
}

export function normalizeInline(s: string): string {
  return serialize(tokenizeInline(s));
}

/**
 * The rich string to render for a block, or null when there is none or it no
 * longer matches the plain text (a later pass rewrote `text`).  Note refs are
 * invisible in plain text, so they never cause a mismatch.
 */
export function resolveRich(plain: string | undefined, rich: string | undefined): string | null {
  if (!rich || !hasInline(rich)) return null;
  const norm = (x: string) => x.replace(/\s+/g, " ").trim();
  return norm(stripInline(rich)) === norm(plain || "") ? rich.trim() : null;
}
