// Stamps a diagonal preview watermark + Racana footer credit on every page.
// Used for free-tier downloads — every shared draft advertises the product.
//
// Fail-closed: if the watermark overlay fails for any reason, we throw
// rather than returning the unwatermarked PDF.  Returning a clean PDF on
// error would give free users a print-ready file with no watermark.
export async function addWatermarkOverlayToPdf(
  originalPdf: Buffer,
  watermarkText: string
): Promise<Buffer> {
  const { PDFDocument, StandardFonts, rgb, degrees } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.load(originalPdf, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const angle = Math.atan2(height, width);
    const fontSize = Math.max(28, Math.min(44, width / 14));
    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
    page.drawText(watermarkText, {
      x: width / 2 - (Math.cos(angle) * textWidth) / 2,
      y: height / 2 + (Math.sin(angle) * textWidth) / 2,
      size: fontSize,
      font,
      color: rgb(0.64, 0.28, 0.15),
      opacity: 0.14,
      rotate: degrees((angle * 180) / Math.PI),
    });
    const credit = "Typeset by Racana · racana.studio · Free preview";
    page.drawText(credit, {
      x: width / 2 - font.widthOfTextAtSize(credit, 8) / 2,
      y: 14,
      size: 8,
      font,
      color: rgb(0.55, 0.53, 0.5),
      opacity: 0.7,
    });
  }

  return Buffer.from(await pdfDoc.save());
}
