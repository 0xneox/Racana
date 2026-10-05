import { it } from "vitest";
import fs from "fs";
import path from "path";
import { analyzeManuscript } from "../src/lib/ai/analyzer";
import { generateTypstSource } from "../src/lib/renderer/typst/generator";
import { compileTypst } from "../src/lib/renderer/typst/compiler";
import { padPdfToMultiple } from "../src/lib/renderer/publication-renderer";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";

const FIXTURE = path.join(__dirname, "fixtures", "ROOT_ACCESS_Print_Ready_Formatted.docx");
const FONTS_DIR = path.join(process.cwd(), "src", "lib", "renderer", "fonts");

it("renders ROOT_ACCESS preview to .typst-render-tmp/root-repro.pdf", async () => {
  const buf = fs.readFileSync(FIXTURE);
  const structure = await analyzeManuscript(buf, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", path.basename(FIXTURE));
  const settings = getEffectiveSettings(getTemplate("classic"), "6x9", {});
  const gen = generateTypstSource({ jobId: "repro", structure, settings, templateName: "classic", preview: true });
  fs.writeFileSync(".typst-render-tmp/root-repro.typ", gen.source);
  const pdf = await padPdfToMultiple(await compileTypst(gen.source, FONTS_DIR, gen.images), 4);
  fs.writeFileSync(".typst-render-tmp/root-repro.pdf", pdf);
}, 240_000);
