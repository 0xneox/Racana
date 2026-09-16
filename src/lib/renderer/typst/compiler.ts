import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import type { EmbeddedImage } from "./generator";

const execFileAsync = promisify(execFile);

async function resolveTypstBin(workspaceRoot: string): Promise<string> {
  const candidates = [
    path.join(workspaceRoot, "bin", "typst.exe"),
    path.join(workspaceRoot, "bin", "typst"),
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
  const workspaceRoot = process.cwd();
  const typstTmpDir = path.join(workspaceRoot, ".typst-render-tmp");
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

    const binToUse = await resolveTypstBin(workspaceRoot);

    await execFileAsync(binToUse, [
      "compile",
      "--root",
      workspaceRoot,
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
