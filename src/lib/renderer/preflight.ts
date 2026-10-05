import type {
  Block,
  BookStructureV1,
  PreflightItem,
  PreflightReport,
} from "../manuscript/types";

// Pre-generation review.  Every check *flags for human eyes* — nothing here
// mutates the author's text.  Each item is a checklist row the UI presents as
// "Looks right / Fix it" before the PDF is generated.

const LONG_PARAGRAPH_CHARS = 1500;
const KDP_SPINE_MIN_PAGES = 79;

function* walkBlocks(structure: BookStructureV1): Generator<{ block: Block; where: string }> {
  const walk = (blocks: Block[] | undefined, where: string): Generator<{ block: Block; where: string }> => {
    const out: { block: Block; where: string }[] = [];
    for (const b of blocks || []) {
      out.push({ block: b, where });
      if (b.blocks) out.push(...walk(b.blocks, where));
    }
    return out as never;
  };
  for (const fm of structure.frontMatter || []) yield* walk(fm.blocks, `front matter (${fm.type})`);
  for (const ch of structure.chapters || []) {
    const label = ch.kind === "part" ? ch.label || "part" : `chapter ${ch.number}`;
    for (const s of ch.sections || []) yield* walk(s.blocks, label);
  }
  for (const bm of structure.backMatter || []) yield* walk(bm.blocks, `back matter (${bm.title || bm.type})`);
}

function blockTexts(b: Block): string[] {
  const t: string[] = [];
  if (b.text) t.push(b.text);
  if (b.items) t.push(...b.items);
  if (b.rows) for (const r of b.rows) for (const c of r.cells) t.push(c.text);
  return t;
}

const TERMINAL_PUNCT = /[.!?…:;"'’”)\]]\s*$/;
const ODD_TOKEN = /(^|\s)(#\d+|\[?\?\]|<unknown>|TODO|TBD|\bXXX\b)(\s|$|[,.:;])/;

export function runPreflight(structure: BookStructureV1): PreflightReport {
  const items: PreflightItem[] = [];

  // -- Unbalanced quotation marks ------------------------------------------
  let unbalanced = 0;
  let unbalancedWhere = "";
  for (const { block, where } of walkBlocks(structure)) {
    for (const t of blockTexts(block)) {
      const openD = (t.match(/\u201C/g) || []).length;
      const closeD = (t.match(/\u201D/g) || []).length;
      const straight = (t.match(/(?<![\w'])"(?![\w'])/g) || []).length;
      const openS = (t.match(/\u2018/g) || []).length;
      const closeS = (t.match(/\u2019/g) || []).length;
      if (openD !== closeD || straight % 2 !== 0 || openS !== closeS) {
        unbalanced++;
        if (!unbalancedWhere) {
          unbalancedWhere = where;
        }
      }
    }
  }
  items.push({
    id: "unbalanced_quotes",
    label: "Quotation marks are balanced",
    status: unbalanced === 0 ? "ok" : "check",
    detail:
      unbalanced === 0
        ? undefined
        : `${unbalanced} paragraph(s) contain unmatched quote marks — check for missing “” pairs.`,
    location: unbalancedWhere || undefined,
  });

  // -- Truncated-looking sentences ------------------------------------------
  const truncated: string[] = [];
  for (const { block, where } of walkBlocks(structure)) {
    if (block.type !== "paragraph") continue;
    const t = (block.text || "").trim();
    if (t.length < 160) continue;
    if (TERMINAL_PUNCT.test(t)) continue;
    truncated.push(`${where}: “…${t.slice(-60)}”`);
  }
  items.push({
    id: "truncated_sentences",
    label: "No sentences look truncated",
    status: truncated.length === 0 ? "ok" : "check",
    detail:
      truncated.length === 0
        ? undefined
        : `${truncated.length} long paragraph(s) end without terminal punctuation.`,
    location: truncated[0],
  });

  // -- Low-confidence headings ----------------------------------------------
  const lowConf: string[] = [];
  for (const { block, where } of walkBlocks(structure)) {
    if (block.type.startsWith("heading") && (block.confidence ?? 1) < 0.8) {
      lowConf.push(`${where}: "${(block.text || "").slice(0, 60)}"`);
    }
  }
  items.push({
    id: "low_confidence_headings",
    label: "All headings were detected confidently",
    status: lowConf.length === 0 ? "ok" : "check",
    detail:
      lowConf.length === 0
        ? undefined
        : `${lowConf.length} heading(s) came from heuristics — confirm they should be headings.`,
    location: lowConf[0],
  });

  // -- Odd tokens -------------------------------------------------------------
  const oddTokens: string[] = [];
  for (const { block, where } of walkBlocks(structure)) {
    for (const t of blockTexts(block)) {
      const m = t.match(ODD_TOKEN);
      if (m) oddTokens.push(`${where}: "${m[2]}"`);
    }
  }
  items.push({
    id: "odd_tokens",
    label: "No odd tokens (#2, [?], TODO) in the text",
    status: oddTokens.length === 0 ? "ok" : "check",
    detail:
      oddTokens.length === 0
        ? undefined
        : `${oddTokens.length} suspicious token(s) found, e.g. ${oddTokens[0]}.`,
    location: oddTokens[0],
  });

  // -- Very long paragraphs ---------------------------------------------------
  let longCount = 0;
  let longWhere = "";
  for (const { block, where } of walkBlocks(structure)) {
    if (block.type === "paragraph" && (block.text || "").length > LONG_PARAGRAPH_CHARS) {
      longCount++;
      if (!longWhere) longWhere = where;
    }
  }
  items.push({
    id: "long_paragraphs",
    label: "No unusually long paragraphs",
    status: longCount === 0 ? "ok" : "check",
    detail:
      longCount === 0
        ? undefined
        : `${longCount} paragraph(s) exceed ${LONG_PARAGRAPH_CHARS} characters — they may hide merged paragraphs.`,
    location: longWhere || undefined,
  });

  // -- Page count --------------------------------------------------------------
  const estimatedPages = Math.max(
    1,
    structure.estimatedPages ||
      Math.ceil(
        (structure.chapters || []).reduce((n, c) => n + (c.wordCount || 0), 0) / 275
      )
  );
  const belowKdpSpineMinimum = estimatedPages < KDP_SPINE_MIN_PAGES;
  const needsEndPad = estimatedPages % 2 !== 0;
  const pageDetail: string[] = [];
  if (belowKdpSpineMinimum)
    pageDetail.push(`${estimatedPages} pages is below the ${KDP_SPINE_MIN_PAGES}-page minimum for KDP spine text.`);
  if (needsEndPad)
    pageDetail.push(`Odd page count — a blank end page will be added to reach a multiple of 4.`);
  items.push({
    id: "page_count",
    label: "Page count is viable for print",
    status: pageDetail.length === 0 ? "ok" : "check",
    detail: pageDetail.length ? pageDetail.join(" ") : `~${estimatedPages} pages.`,
  });

  return { items, estimatedPages, belowKdpSpineMinimum, needsEndPad };
}
