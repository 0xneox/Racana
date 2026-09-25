import path from "path";
import fs from "fs";
import { pathToFileURL } from "url";
import { resolveAppRoot } from "./app-root";

// pdfjs needs its worker module as a real file on disk. In dev it lives in
// node_modules; in standalone builds we trace it into the bundle's node_modules
// (see next.config.js outputFileTracingIncludes). Used by both the manuscript
// PDF parser and the renderer QA check.
export function resolvePdfWorker(): string | null {
  const rel = path.join("node_modules", "pdfjs-dist", "build", "pdf.worker.mjs");
  const candidates = [
    path.join(process.cwd(), rel), // standalone: cwd = .next/standalone
    path.join(resolveAppRoot(), rel), // dev / docker runner
    path.join(process.cwd(), "..", "..", rel),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      // pdfjs lazy-imports the worker via the ESM loader — bare absolute paths
      // are rejected on Windows; it must be a file:// URL.
      return pathToFileURL(c).href;
    }
  }
  return null;
}
