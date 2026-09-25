import type { EmbeddedImage, QAIssue } from "./types";

// Every image the manuscript declared vs. what actually got embedded — plus a
// magic-byte sanity check on each buffer before Typst sees it. A corrupt image
// would otherwise fail the whole compile with an opaque engine error.

const IMAGE_MAGIC: { name: string; test: (b: Buffer) => boolean }[] = [
  { name: "png", test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { name: "jpeg", test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { name: "gif", test: (b) => b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 },
  { name: "webp", test: (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" },
  { name: "bmp", test: (b) => b.length > 2 && b[0] === 0x42 && b[1] === 0x4d },
  { name: "tiff", test: (b) => b.length > 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)) },
];

export function hasKnownImageMagic(buffer: Buffer): boolean {
  return IMAGE_MAGIC.some((m) => m.test(buffer));
}

export function verifyEmbeddedImages(
  images: EmbeddedImage[],
  declaredImageBlocks: number
): QAIssue[] {
  const issues: QAIssue[] = [];

  const dropped = Math.max(0, declaredImageBlocks - images.length);
  if (dropped > 0) {
    issues.push({
      code: "IMAGE_EMBED_DROPPED",
      level: "warning",
      description: `${dropped} image(s) from the manuscript could not be decoded and were replaced with placeholders.`,
    });
  }

  images.forEach((img, idx) => {
    if (!img.buffer || img.buffer.length < 12 || !hasKnownImageMagic(img.buffer)) {
      issues.push({
        code: "IMAGE_CORRUPT",
        level: "warning",
        description: `Embedded image ${idx + 1} (${img.fileName}) has an unrecognized format.`,
      });
    }
  });

  return issues;
}
