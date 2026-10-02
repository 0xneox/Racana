import fs from "fs";
import { parseDocx } from "./src/lib/manuscript/docx-parser";
(async () => {
  const buf = fs.readFileSync("tests/fixtures/ROOT_ACCESS_Print_Ready_Formatted.docx");
  const { blocks } = await parseDocx(buf);
  const re = /[\u0900-\u097F]|tat tvam|tattvam|asi/i;
  blocks.forEach((b: any, i: number) => {
    const t = b.text || "";
    if (re.test(t)) console.log(`--- ${i} [${b.type}]\n${t}\n`);
  });
  console.log("=== practice steps sample ===");
  [164,165,166].forEach(i => console.log(i, JSON.stringify(blocks[i].text)));
  console.log("=== part/chapter markers ===");
  [59,60,61,62,63,174,175,176,297,298,299].forEach(i => console.log(i, blocks[i].type, JSON.stringify((blocks[i].text||"").slice(0,80))));
})();
