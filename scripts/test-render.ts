// End-to-end smoke: real manuscript file -> analyzer -> typeset -> PDF on disk.
//   npx tsx scripts/test-render.ts <file> [template] [out.pdf]
import fs from "fs";
import path from "path";
import { analyzeManuscript } from "../src/lib/ai/analyzer";
import { generatePublication } from "../src/lib/renderer/publication-renderer";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";

async function main() {
  const file = process.argv[2] || "root.pdf";
  const templateKey = process.argv[3] || "philosophy";
  const out = process.argv[4] || `rendered-${path.basename(file, path.extname(file))}.pdf`;

  const buf = fs.readFileSync(file);
  const mime = file.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  console.log(`Analyzing ${file} (${(buf.length / 1024).toFixed(0)} KB)...`);
  const structure = await analyzeManuscript(buf, mime, path.basename(file));
  console.log(`  title="${structure.title}" author="${structure.author ?? "?"}"`);
  console.log(`  type=${structure.detectedBookType} script=${structure.detectedScript} (${structure.scriptLabel})`);
  console.log(`  chapters=${structure.chapterCount} estPages=${structure.estimatedPages} warnings=${structure.warnings.length}`);
  structure.chapters.slice(0, 8).forEach((c) => console.log(`    ch${c.number}: "${c.title}" (${c.wordCount}w)`));

  const tpl = getTemplate(templateKey);
  const settings = getEffectiveSettings(tpl, "trim_6x9", {});
  console.log(`\nRendering with template "${templateKey}"...`);
  const { pdfBuffer, qaResult } = await generatePublication({
    jobId: "manual-test",
    structure,
    settings,
    templateName: templateKey,
  });

  fs.writeFileSync(out, pdfBuffer);
  console.log(`\nDone -> ${out} (${(pdfBuffer.length / 1024).toFixed(0)} KB)`);
  console.log(`QA: passed=${qaResult.passed} score=${qaResult.score} pages=${qaResult.pageCount}`);
  qaResult.issues.forEach((i) => console.log(`  [${i.level}] ${i.code}: ${i.description}`));
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
