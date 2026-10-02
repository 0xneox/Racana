import fs from "fs";
import { parseDocx } from "./src/lib/manuscript/docx-parser";

(async () => {
  const buf = fs.readFileSync("tests/fixtures/ROOT_ACCESS_Print_Ready_Formatted.docx");
  const { blocks, rawText } = await parseDocx(buf);
  console.log("TOTAL BLOCKS:", blocks.length);
  const counts: Record<string, number> = {};
  for (const b of blocks) counts[b.type] = (counts[b.type] || 0) + 1;
  console.log(counts);
  blocks.forEach((b: any, i: number) => {
    const t = (b.text || "").replace(/\n/g, " \n ");
    const extra = b.items ? ` items=${b.items.length}` : "";
    console.log(`${i}\t${b.type}${extra}\t${t.slice(0, 120)}`);
  });
})();
