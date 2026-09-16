import { describe, it, expect } from "vitest";
import {
  validateManuscript,
  MAX_FILE_SIZE_BYTES,
  MIN_FILE_SIZE_BYTES,
} from "../src/lib/manuscript/validator";

describe("Manuscript Validator Unit Tests", () => {
  // Helper to create valid fake PDF buffer
  const makeValidPdfBuffer = (size = 1200): Buffer => {
    const buf = Buffer.alloc(size, 0x20);
    buf.write("%PDF-1.4\n1 0 obj\n/Type /Page\nendobj\n", 0, "utf-8");
    return buf;
  };

  // Helper to create valid fake DOCX buffer (ZIP header PK\x03\x04)
  const makeValidDocxBuffer = (size = 2048): Buffer => {
    const buf = Buffer.alloc(size, 0x20);
    buf[0] = 0x50; // P
    buf[1] = 0x4b; // K
    buf[2] = 0x03;
    buf[3] = 0x04;
    return buf;
  };

  it("should accept a valid PDF file with %PDF magic header", () => {
    const pdfBuf = makeValidPdfBuffer();
    const result = validateManuscript(pdfBuf, "My_Novel.pdf", "application/pdf");

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.mimeType).toBe("application/pdf");
    expect(result.pageCountEstimate).toBeGreaterThanOrEqual(1);
  });

  it("should accept a valid DOCX file with ZIP magic header", () => {
    const docxBuf = makeValidDocxBuffer();
    const result = validateManuscript(
      docxBuf,
      "War_and_Peace.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.pageCountEstimate).toBeGreaterThanOrEqual(5);
    expect(result.wordCountEstimate).toBeGreaterThanOrEqual(1000);
  });

  it("should reject an empty file (0 bytes)", () => {
    const emptyBuf = Buffer.alloc(0);
    const result = validateManuscript(emptyBuf, "empty.docx");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("File is empty");
  });

  it("should reject a file smaller than minimum valid document threshold", () => {
    const tinyBuf = Buffer.from("hello world");
    const result = validateManuscript(tinyBuf, "tiny.docx");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("too small");
  });

  it("should reject an unsupported file extension (.txt or .exe)", () => {
    const txtBuf = Buffer.alloc(1000, 0x41);
    const result = validateManuscript(txtBuf, "document.txt");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unsupported file format");
  });

  it("should reject a fake PDF that lacks the %PDF magic bytes", () => {
    const fakePdfBuf = Buffer.alloc(1200, 0x41); // All 'A's, no %PDF
    const result = validateManuscript(fakePdfBuf, "corrupted.pdf");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Corrupt or invalid PDF");
  });

  it("should reject a fake DOCX that lacks the PK ZIP magic bytes", () => {
    const fakeDocxBuf = Buffer.alloc(2000, 0x42); // All 'B's, no PK\x03\x04
    const result = validateManuscript(fakeDocxBuf, "corrupted.docx");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Corrupt or invalid DOCX");
  });

  it("should reject a file exceeding the 50MB maximum size limit", () => {
    // Simulate oversized file metadata
    const hugeBuf = { length: MAX_FILE_SIZE_BYTES + 1024 } as unknown as Buffer;
    const result = validateManuscript(hugeBuf, "huge.docx");

    expect(result.valid).toBe(false);
    expect(result.error).toContain("exceeds 50MB");
  });

  it("should enforce MVP page count bounds between 5 and 300 pages", () => {
    const docxBuf = makeValidDocxBuffer(50000);
    const result = validateManuscript(docxBuf, "Standard_Manuscript.docx");

    expect(result.valid).toBe(true);
    expect(result.pageCountEstimate).toBeGreaterThanOrEqual(5);
    expect(result.pageCountEstimate).toBeLessThanOrEqual(300);
  });
});
