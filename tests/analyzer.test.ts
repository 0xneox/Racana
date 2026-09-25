import { it, expect } from "vitest";
import { analyzeManuscript } from "../src/lib/ai/analyzer";
import fs from "fs";

it("probe analyzer output on both fixtures", async () => {
  for (const f of ["tests/fixtures/novel_chapters.docx", "tests/fixtures/philosophy_meditations.docx"]) {
    const buf = fs.readFileSync(f);
    const s = await analyzeManuscript(buf, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", f);
    console.log(`\n=== ${f} ===`);
    console.log("title:", s.title, "| author:", s.author, "| type:", s.detectedBookType);
    console.log("chapters:", s.chapterCount, "| estPages:", s.estimatedPages, "| warnings:", s.warnings.length);
    console.log("chapter titles:", s.chapters.map((c: any) => c.title).slice(0, 15));
    expect(s.chapterCount).toBeGreaterThan(0);
    expect(s.author?.length ?? 0).toBeLessThan(80);
  }
}, 60000);
