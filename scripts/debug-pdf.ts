import fs from "fs";
import { parsePdf } from "../src/lib/manuscript/pdf-parser";

async function main() {
  const buf = fs.readFileSync("root.pdf");
  const { rawText } = await parsePdf(buf);
  const lines = rawText.split(/\r?\n/);

  // Candidate chapter titles: short standalone lines that look like titles,
  // sitting right after a page number or furniture line.
  const isFurniture = (l: string) => {
    const t = (l || "").trim();
    return /^[-–—*\s]*\d+\s*(of\s+\d+)?\s*[-–—*\s]*$/.test(t) || /^page\s+\d+/i.test(t);
  };
  for (let i = 0; i < lines.length; i++) {
    const t = (lines[i] || "").trim();
    if (!t || t.length > 55) continue;
    const words = t.split(/\s+/).length;
    if (words > 10) continue;
    if (/[.!?,;:]$/.test(t)) continue;
    if (!/^[A-Z\u0900-\u097F"'\u201C]/.test(t)) continue;
    const prevIdx = i - 1;
    const prev = prevIdx >= 0 ? (lines[prevIdx] || "").trim() : "";
    const afterFurniture = isFurniture(prev) || isFurniture(lines[i - 2] || "");
    const tag = afterFurniture ? "PAGE-START" : "          ";
    console.log(`${tag} L${String(i).padStart(4)}: ${t}`);
  }
}
main();
