import fs from "fs";
import { parseDocx } from "./src/lib/manuscript/docx-parser";
(async () => {
  const buf = fs.readFileSync("tests/fixtures/ROOT_ACCESS_Print_Ready_Formatted.docx");
  const { blocks } = await parseDocx(buf);
  blocks.forEach((b: any, i: number) => {
    const t = (b.text || "");
    if (/[\u0900-\u097F]/.test(t) || /tvam|tattvam/i.test(t) || /[“”'"].*—/.test(t) || /verse|tantra/i.test(t.slice(0,60))) {
      console.log(`--- ${i} [${b.type}]`);
      console.log(t.slice(0, 400));
    }
  });
  // missing-space / glued-heading candidates
  console.log("=== GLUED ===");
  blocks.forEach((b: any, i: number) => {
    const t = b.text || "";
    const m = t.match(/[a-z]\.[A-Z]/g);
    if (m) console.log(`${i}: ${m.join(",")} :: ${t.slice(0, 100)}`);
  });
})();
