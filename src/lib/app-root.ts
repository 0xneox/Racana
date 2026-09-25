import path from "path";
import fs from "fs";

// The standalone Next.js server (output: "standalone") runs with cwd set to
// .next/standalone, so process.cwd() alone cannot locate bin/, fonts, or Typst
// templates. Resolution order:
//   1. RACANA_ROOT env var (explicit override for deployments)
//   2. cwd if it contains the renderer assets (dev, Docker runner)
//   3. cwd/../.. (standalone: .next/standalone -> project root)
const MARKER = path.join("src", "lib", "renderer", "typst", "templates");

let cachedRoot: string | null = null;

export function resolveAppRoot(): string {
  if (cachedRoot) return cachedRoot;

  const candidates = [
    process.env.RACANA_ROOT,
    process.cwd(),
    path.resolve(process.cwd(), "..", ".."),
  ].filter((c): c is string => !!c);

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, MARKER))) {
      cachedRoot = candidate;
      return candidate;
    }
  }

  cachedRoot = process.env.RACANA_ROOT || process.cwd();
  return cachedRoot;
}
