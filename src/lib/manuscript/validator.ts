export interface ValidationResult {
  valid: boolean;
  error?: string;
  pageCountEstimate: number;
  wordCountEstimate: number;
  mimeType: string;
}

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const MIN_FILE_SIZE_BYTES = 500; // Less than 500 bytes is not a valid DOCX or PDF
export const MIN_PAGES_ESTIMATE = 5;
export const MAX_PAGES_ESTIMATE = 300;

export function validateManuscript(
  buffer: Buffer,
  fileName: string,
  providedMime?: string
): ValidationResult {
  if (!buffer || buffer.length === 0) {
    return {
      valid: false,
      error: "File is empty (0 bytes). Please upload a valid manuscript.",
      pageCountEstimate: 0,
      wordCountEstimate: 0,
      mimeType: "unknown",
    };
  }

  if (buffer.length < MIN_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "File is too small to be a valid DOCX or PDF document.",
      pageCountEstimate: 0,
      wordCountEstimate: 0,
      mimeType: "unknown",
    };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "File exceeds 50MB limit. Please compress or optimize images.",
      pageCountEstimate: 0,
      wordCountEstimate: 0,
      mimeType: "unknown",
    };
  }

  const lowerName = fileName.toLowerCase();
  const isDocxExt = lowerName.endsWith(".docx");
  const isPdfExt = lowerName.endsWith(".pdf");

  if (!isDocxExt && !isPdfExt) {
    return {
      valid: false,
      error: "Unsupported file format. Please upload a .docx or .pdf file.",
      pageCountEstimate: 0,
      wordCountEstimate: 0,
      mimeType: "unknown",
    };
  }

  // Check magic bytes
  // PDF: %PDF (0x25, 0x50, 0x44, 0x46)
  const isPdfMagic =
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46;

  // DOCX: PK\x03\x04 (ZIP signature: 0x50, 0x4B, 0x03, 0x04)
  const isZipMagic =
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04;

  if (isPdfExt && !isPdfMagic) {
    return {
      valid: false,
      error: "Corrupt or invalid PDF file header. The file does not start with %PDF.",
      pageCountEstimate: 0,
      wordCountEstimate: 0,
      mimeType: "application/pdf",
    };
  }

  if (isDocxExt && !isZipMagic) {
    return {
      valid: false,
      error: "Corrupt or invalid DOCX file header. The file is not a valid OpenXML package.",
      pageCountEstimate: 0,
      wordCountEstimate: 0,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  const mimeType = isPdfExt
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  // Page count estimation
  let pageCount = 0;
  let wordCount = 0;

  if (isPdfExt) {
    // Count occurrences of "/Type /Page" or "/Type/Page" in the PDF stream
    const content = buffer.toString("binary");
    const matches = content.match(/\/Type[\s]*\/Page[^s]/g);
    if (matches && matches.length > 0) {
      pageCount = matches.length;
    } else {
      // Fallback estimate based on byte length (~30KB per page in PDF)
      pageCount = Math.max(5, Math.min(300, Math.round(buffer.length / 32000)));
    }
    wordCount = pageCount * 250;
  } else {
    // DOCX estimate: uncompressed text length or typical docx size
    // A typical novel page is ~275 words; an average 50KB docx is ~15 pages
    const approxWords = Math.round((buffer.length / 1024) * 220);
    wordCount = Math.max(1200, approxWords);
    pageCount = Math.max(5, Math.min(300, Math.ceil(wordCount / 275)));
  }

  return {
    valid: true,
    pageCountEstimate: pageCount,
    wordCountEstimate: wordCount,
    mimeType,
  };
}
