import { it, expect, describe } from "vitest";
import { detectScript } from "../src/lib/manuscript/script";
import { generatePublication } from "../src/lib/renderer/publication-renderer";
import { getTemplate, getEffectiveSettings } from "../src/lib/templates/engine";
import type { BookStructureV1 } from "../src/lib/manuscript/types";

describe("script detection", () => {
  it("detects Devanagari-dominant text", () => {
    const hindi = "यह एक कहानी है। ".repeat(200) + "a few English words";
    expect(detectScript(hindi).script).toBe("devanagari");
  });

  it("detects Tamil and Malayalam", () => {
    expect(detectScript("இது ஒரு கதை ".repeat(100)).script).toBe("tamil");
    expect(detectScript("ഇത് ഒരു കഥയാണ് ".repeat(100)).script).toBe("malayalam");
  });

  it("treats a stray Indic quote in an English book as Latin", () => {
    const text = "The morning sun rose over the valley. ".repeat(300) + "नमस्ते";
    expect(detectScript(text).script).toBe("latin");
    expect(detectScript(text).isIndic).toBe(false);
  });
});

const hindiStructure: BookStructureV1 = {
  schemaVersion: 1,
  title: "मेरा पहला उपन्यास",
  author: "राहुल शर्मा",
  detectedBookType: "novel",
  chapterCount: 1,
  estimatedPages: 5,
  detectedScript: "devanagari",
  scriptLabel: "Hindi · Devanagari",
  warnings: [],
  frontMatter: [],
  chapters: [
    {
      number: 1,
      title: "अध्याय एक",
      wordCount: 400,
      sections: [
        {
          title: "",
          blocks: [
            {
              type: "paragraph",
              text: "सुबह की पहली किरण जब खिड़की से अंदर आई, तो मीरा ने सोचा कि आज का दिन कुछ अलग होगा। ".repeat(40),
            },
            {
              type: "paragraph",
              text: "She paused, mixing English into her Hindi prose — a style familiar to every Indian writer. ".repeat(20),
            },
          ],
        },
      ],
    },
  ],
  backMatter: [],
};

it("renders a Devanagari manuscript to a valid PDF with Noto fonts", async () => {
  const tpl = getTemplate("indian");
  const settings = getEffectiveSettings(tpl, "trim_6x9", {});
  const { pdfBuffer, qaResult } = await generatePublication({
    jobId: "devanagari-test",
    structure: hindiStructure,
    settings,
    templateName: "indian",
  });

  expect(pdfBuffer.slice(0, 5).toString()).toBe("%PDF-");
  expect(qaResult.passed).toBe(true);
  expect(qaResult.pageCount).toBeGreaterThan(0);
  // The Devanagari font must actually be embedded — otherwise glyphs would be tofu.
  const embedsNoto =
    pdfBuffer.includes(Buffer.from("NotoSerifDevanagari")) ||
    pdfBuffer.includes(Buffer.from("Noto Serif Devanagari"));
  expect(embedsNoto).toBe(true);
}, 120000);

it("renders mixed-script content on the classic template via font fallback", async () => {
  const tpl = getTemplate("classic");
  const settings = getEffectiveSettings(tpl, "trim_6x9", {});
  const { pdfBuffer, qaResult } = await generatePublication({
    jobId: "mixed-script-test",
    structure: hindiStructure,
    settings,
    templateName: "classic",
  });
  expect(pdfBuffer.slice(0, 5).toString()).toBe("%PDF-");
  expect(qaResult.passed).toBe(true);
}, 120000);
