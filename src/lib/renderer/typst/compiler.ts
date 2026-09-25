import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { resolveAppRoot } from "../../app-root";
import type { EmbeddedImage } from "./generator";

const execFileAsync = promisify(execFile);

async function resolveTypstBin(appRoot: string): Promise<string> {
  const candidates = [
    path.join(appRoot, "bin", "typst.exe"),
    path.join(appRoot, "bin", "typst"),
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return "typst"; // fallback to system PATH
}

export async function compileTypst(
  typstSource: string,
  fontsDir: string,
  images: EmbeddedImage[] = []
): Promise<Buffer> {
  // --root must point at the real project root so absolute imports like
  // "/src/lib/renderer/typst/templates/<tpl>.typ" resolve in every runtime.
  const appRoot = resolveAppRoot();
  // Typst requires the source file to live inside --root, so the render tmp
  // dir sits under the app root (created writable for the runtime user in Docker).
  const typstTmpDir = path.join(appRoot, ".typst-render-tmp");
  await fs.mkdir(typstTmpDir, { recursive: true }).catch(() => {});
  const tmpDir = await fs.mkdtemp(path.join(typstTmpDir, "render-"));
  const inputPath = path.join(tmpDir, "main.typ");
  const outputPath = path.join(tmpDir, "output.pdf");

  try {
    await fs.writeFile(inputPath, typstSource, "utf-8");

    // Write embedded images next to main.typ so #image("images/...") resolves
    for (const img of images) {
      const dest = path.join(tmpDir, img.fileName);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, img.buffer);
    }

    const binToUse = await resolveTypstBin(appRoot);

    await execFileAsync(binToUse, [
      "compile",
      "--root",
      appRoot,
      "--font-path",
      fontsDir,
      inputPath,
      outputPath,
    ]);

    const pdfBuffer = await fs.readFile(outputPath);
    return pdfBuffer;
  } finally {
    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(console.error);
  }
}

// Compiles the same source to per-page PNGs — used for the in-app preview
// gallery on /ready. Feed it a truncated source (see worker) so only the
// first few pages are rasterized.
export async function compileTypstPng(
  typstSource: string,
  fontsDir: string,
  images: EmbeddedImage[] = [],
  maxPages = 4
): Promise<Buffer[]> {
  const appRoot = resolveAppRoot();
  const typstTmpDir = path.join(appRoot, ".typst-render-tmp");
  await fs.mkdir(typstTmpDir, { recursive: true }).catch(() => {});
  const tmpDir = await fs.mkdtemp(path.join(typstTmpDir, "preview-"));
  const inputPath = path.join(tmpDir, "main.typ");
  const outputPattern = path.join(tmpDir, "page-{n}.png");

  try {
    await fs.writeFile(inputPath, typstSource, "utf-8");

    for (const img of images) {
      const dest = path.join(tmpDir, img.fileName);
      await fs.mkdir(path.dirname(dest), { recursive: true });
      await fs.writeFile(dest, img.buffer);
    }

    const binToUse = await resolveTypstBin(appRoot);

    await execFileAsync(binToUse, [
      "compile",
      "--root",
      appRoot,
      "--font-path",
      fontsDir,
      "--format",
      "png",
      "--ppi",
      "144",
      inputPath,
      outputPattern,
    ]);

    const files = (await fs.readdir(tmpDir))
      .filter((f) => /^page-\d+\.png$/.test(f))
      .sort((a, b) => parseInt(a.match(/\d+/)![0], 10) - parseInt(b.match(/\d+/)![0], 10))
      .slice(0, maxPages);

    const pages: Buffer[] = [];
    for (const f of files) {
      pages.push(await fs.readFile(path.join(tmpDir, f)));
    }
    return pages;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(console.error);
  }
}
