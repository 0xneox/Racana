import fs from "fs";
import { analyzeManuscript } from "../src/lib/ai/analyzer";

async function main() {
  const buf = fs.readFileSync("root.pdf");
  const s = await analyzeManuscript(buf, "application/pdf", "root.pdf");
  console.log("frontMatter:", s.frontMatter.length, "entries");
  s.frontMatter.forEach((f) => console.log(`  fm[${f.type}] "${f.title}" blocks=${f.blocks.length} chars=${f.blocks.reduce((n, b) => n + (b.text || "").length, 0)}`));
  console.log("chapters:", s.chapters.length);
  s.chapters.forEach((c) => {
    const chars = c.sections.reduce((n, sec) => n + sec.blocks.reduce((m, b) => m + (b.text || "").length, 0), 0);
    console.log(`  ch${c.number} "${c.title.slice(0, 60)}" sections=${c.sections.length} chars=${chars}`);
  });
  console.log("backMatter:", s.backMatter.length);
}
main();
