import path from "path";
import { generateTypstSource } from "./typst/generator";
import { compileTypst } from "./typst/compiler";
import type { RendererOptions, QAReportResult } from "./types";
import { runPdfQa } from "./qa";

export async function generatePublication(options: RendererOptions): Promise<{ pdfBuffer: Buffer; qaResult: QAReportResult }> {
  // 1. Generate Typst source code
  const { source: typstSource, images } = generateTypstSource(options);

  // 2. Compile to PDF
  const workspaceRoot = process.cwd();
  const fontsDir = path.join(workspaceRoot, "src", "lib", "renderer", "fonts");
  const pdfBuffer = await compileTypst(typstSource, fontsDir, images);

  // 3. QA
  const qaResult = await runPdfQa(pdfBuffer, options);
  
  if (!qaResult.passed) {
    throw new Error(`QA Failed: ${qaResult.issues.map(i => i.description).join(", ")}`);
  }

  return { pdfBuffer, qaResult };
}
