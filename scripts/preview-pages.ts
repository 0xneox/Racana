import fs from "fs";
import path from "path";
import { analyzeManuscript } from "../src/lib/ai/analyzer";
import { generateTypstSource } from "../src/lib/renderer/typst/generator";
import { compileTypstPng } from "../src/lib/renderer/typst/compiler";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";
import { resolveAppRoot } from "../src/lib/app-root";

async function main() {
  const buf = fs.readFileSync("root.pdf");
  const s = await analyzeManuscript(buf, "application/pdf", "root.pdf");
  // Truncate to ~first pages like the worker preview does
  const clone: typeof s = JSON.parse(JSON.stringify(s));
  clone.frontMatter = (clone.frontMatter || []).slice(0, 2);
  clone.backMatter = [];
  const first = clone.chapters[0];
  if (first) {
    let budget = 14;
    first.sections = first.sections.map((sec) => {
      const blocks = sec.blocks.slice(0, Math.max(0, budget));
      budget -= blocks.length;
      return { ...sec, blocks };
    });
    clone.chapters = [first];
  }
  const settings = getEffectiveSettings(getTemplate("philosophy"), "trim_6x9", {});
  const { source, images } = generateTypstSource({
    jobId: "preview-test",
    structure: clone,
    settings,
    templateName: "philosophy",
  });
  const pages = await compileTypstPng(
    source,
    path.join(resolveAppRoot(), "src", "lib", "renderer", "fonts"),
    images,
    4
  );
  pages.forEach((p, i) => fs.writeFileSync(`preview-page-${i + 1}.png`, p));
  console.log(`wrote ${pages.length} preview pages`);
}
main().catch((e) => { console.error(e); process.exit(1); });
