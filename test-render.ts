import fs from "fs";
import path from "path";
import { generatePublication } from "./src/lib/renderer/publication-renderer";
import type { BookStructureV1 } from "./src/lib/manuscript/types";
import { getEffectiveSettings, getTemplate } from "./src/lib/templates/engine";

async function main() {
  const structure: BookStructureV1 = {
    schemaVersion: 1,
    title: "The Odyssey of Code",
    subtitle: "A Journey Through the AST",
    author: "Alice Developer",
    chapterCount: 5,
    estimatedPages: 60,
    warnings: [],
    frontMatter: [
      {
        type: "title-page",
        title: "",
        blocks: [
          { type: "paragraph", text: "Published 2026" }
        ]
      }
    ],
    chapters: Array.from({ length: 5 }, (_, i) => ({
      number: i + 1,
      title: `Chapter ${i + 1}: Discovery`,
      wordCount: 3000,
      sections: [
        {
          title: "The Beginning",
          blocks: [
            { type: "paragraph", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(20) },
            { type: "heading_h2", text: "A Deeper Dive" },
            { type: "paragraph", text: "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ".repeat(15) },
            { type: "quote", text: "To code is to breathe life into logic." },
            { type: "paragraph", text: "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. ".repeat(20) },
            { type: "list_ordered", items: ["First item", "Second item", "Third item"] },
            { type: "paragraph", text: "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. ".repeat(30) },
          ]
        }
      ]
    })),
    backMatter: [
      {
        type: "about-author",
        title: "About the Author",
        blocks: [
          { type: "paragraph", text: "Alice has been writing code since she was 12." }
        ]
      }
    ]
  };

  const templateDef = getTemplate("classic");
  const settings = getEffectiveSettings(templateDef, "6x9", {});

  try {
    const { pdfBuffer, qaResult } = await generatePublication({
      jobId: "test-job",
      structure,
      settings,
      templateName: "classic"
    });

    console.log("QA Result:", qaResult);
    
    const outPath = path.join(process.cwd(), "test-output.pdf");
    fs.writeFileSync(outPath, pdfBuffer);
    console.log(`Successfully generated PDF: ${outPath} (${pdfBuffer.length} bytes)`);
  } catch (err) {
    console.error("Failed to generate publication:", err);
  }
}

main();
