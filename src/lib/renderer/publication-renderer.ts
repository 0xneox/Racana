import path from "path";
import { generateTypstSource } from "./typst/generator";
import { compileTypst } from "./typst/compiler";
import { resolveAppRoot } from "../app-root";
import { verifyEmbeddedImages } from "./image-check";
import type { RendererOptions, QAReportResult } from "./types";
import { runPdfQa } from "./qa";

export async function generatePublication(options: RendererOptions): Promise<{ pdfBuffer: Buffer; qaResult: QAReportResult }> {
  // 1. Generate Typst source code
  const { source: typstSource, images, imageBlockCount } = generateTypstSource(options);

  // 2. Compile to PDF
  const appRoot = resolveAppRoot();
  const fontsDir = path.join(appRoot, "src", "lib", "renderer", "fonts");
  const pdfBuffer = await compileTypst(typstSource, fontsDir, images);

  // 3. Image verification — every declared image block embedded and decodable
  const imageIssues = verifyEmbeddedImages(images, imageBlockCount);

  // 4. QA (pages, trim size, extractable text)
  const qaResult = await runPdfQa(pdfBuffer, options, imageIssues);

  if (!qaResult.passed) {
    throw new Error(`QA Failed: ${qaResult.issues.map(i => i.description).join(", ")}`);
  }

  return { pdfBuffer, qaResult };
}
