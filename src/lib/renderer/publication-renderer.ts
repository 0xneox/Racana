import path from "path";
import { generateTypstSource } from "./typst/generator";
import { compileTypst } from "./typst/compiler";
import { resolveAppRoot } from "../app-root";
import { verifyEmbeddedImages } from "./image-check";
import type { RendererOptions, QAReportResult } from "./types";
import { runPdfQa } from "./qa";

// POD signatures come in multiples of 4 leaves.  Pad the compiled PDF with
// truly blank pages (pdf-lib blank pages carry zero content objects, so no
// folio/running-head/watermark can leak onto them).  Doing this in Typst
// instead makes the layout pass non-convergent.
export async function padPdfToMultiple(pdfBuffer: Buffer, multiple: number): Promise<Buffer> {
  if (multiple <= 1) return pdfBuffer;
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const pages = doc.getPageCount();
  const rem = pages % multiple;
  if (rem === 0) return pdfBuffer;
  const last = doc.getPage(pages - 1);
  const { width, height } = last.getSize();
  const need = multiple - rem;
  for (let i = 0; i < need; i++) doc.addPage([width, height]);
  // Keep object streams off: the QA font scan reads /BaseFont names directly
  // from the PDF bytes.
  return Buffer.from(await doc.save({ useObjectStreams: false }));
}

export async function generatePublication(options: RendererOptions): Promise<{ pdfBuffer: Buffer; qaResult: QAReportResult }> {
  // 1. Generate Typst source code
  const { source: typstSource, images, imageBlockCount } = generateTypstSource(options);

  // 2. Compile to PDF
  const appRoot = resolveAppRoot();
  const fontsDir = path.join(appRoot, "src", "lib", "renderer", "fonts");
  const rawPdf = await compileTypst(typstSource, fontsDir, images);

  // 2b. Signature padding — blank leaves to a multiple of 4.
  const pdfBuffer = await padPdfToMultiple(rawPdf, 4);

  // 3. Image verification — every declared image block embedded and decodable
  const imageIssues = verifyEmbeddedImages(images, imageBlockCount);

  // 4. QA (pages, trim size, extractable text)
  const qaResult = await runPdfQa(pdfBuffer, options, imageIssues);

  if (!qaResult.passed) {
    throw new Error(`QA Failed: ${qaResult.issues.map(i => i.description).join(", ")}`);
  }

  return { pdfBuffer, qaResult };
}
