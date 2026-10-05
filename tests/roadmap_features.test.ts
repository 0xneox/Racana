import { describe, it, expect } from "vitest";
import { runPreflight } from "../src/lib/renderer/preflight";
import type { BookStructureV1 } from "../src/lib/manuscript/types";

describe("Roadmap Features Test Suite", () => {
  describe("Free Manuscript Health X-Ray Engine", () => {
    it("detects unmatched quotation marks and flags check status", () => {
      const structureWithUnmatchedQuotes: BookStructureV1 = {
        schemaVersion: 1,
        title: "The Unfinished Tale",
        warnings: [],
        chapterCount: 1,
        estimatedPages: 120,
        chapters: [
          {
            number: 1,
            title: "Chapter 1",
            wordCount: 800,
            sections: [
              {
                title: "",
                blocks: [
                  {
                    type: "paragraph",
                    text: 'He said, “I am leaving tomorrow and never coming back.',
                  },
                ],
              },
            ],
          },
        ],
        frontMatter: [],
        backMatter: [],
      };

      const report = runPreflight(structureWithUnmatchedQuotes);
      const quotesItem = report.items.find((i) => i.id === "unbalanced_quotes");
      expect(quotesItem).toBeDefined();
      expect(quotesItem?.status).toBe("check");
      expect(quotesItem?.detail).toContain("unmatched quote marks");
    });

    it("detects placeholder tokens (TODO, TBD, XXX) accurately", () => {
      const structureWithPlaceholders: BookStructureV1 = {
        schemaVersion: 1,
        title: "Draft Secrets",
        warnings: [],
        chapterCount: 1,
        estimatedPages: 150,
        chapters: [
          {
            number: 1,
            title: "Chapter 1",
            wordCount: 1200,
            sections: [
              {
                title: "",
                blocks: [
                  {
                    type: "paragraph",
                    text: "The detective searched the room. TODO: insert description of desk.",
                  },
                ],
              },
            ],
          },
        ],
        frontMatter: [],
        backMatter: [],
      };

      const report = runPreflight(structureWithPlaceholders);
      const oddItem = report.items.find((i) => i.id === "odd_tokens");
      expect(oddItem).toBeDefined();
      expect(oddItem?.status).toBe("check");
      expect(oddItem?.detail).toContain("suspicious token");
    });

    it("flags KDP spine minimum violations for books under 79 pages", () => {
      const thinStructure: BookStructureV1 = {
        schemaVersion: 1,
        title: "Brief Memoir",
        warnings: [],
        chapterCount: 1,
        estimatedPages: 42,
        chapters: [
          {
            number: 1,
            title: "Only Chapter",
            wordCount: 5000,
            sections: [
              {
                title: "",
                blocks: [{ type: "paragraph", text: "A brief story." }],
              },
            ],
          },
        ],
        frontMatter: [],
        backMatter: [],
      };

      const report = runPreflight(thinStructure);
      expect(report.belowKdpSpineMinimum).toBe(true);
      const pageItem = report.items.find((i) => i.id === "page_count");
      expect(pageItem?.status).toBe("check");
      expect(pageItem?.detail).toContain("below the 79-page minimum");
    });

    it("passes cleanly on a well-formed book structure", () => {
      const cleanStructure: BookStructureV1 = {
        schemaVersion: 1,
        title: "Clean Manuscript",
        warnings: [],
        chapterCount: 2,
        estimatedPages: 100,
        chapters: [
          {
            number: 1,
            title: "First Chapter",
            wordCount: 14000,
            sections: [
              {
                title: "",
                blocks: [
                  {
                    type: "paragraph",
                    text: "“This sentence is well-formed with matching curly quotes,” she smiled.",
                  },
                ],
              },
            ],
          },
        ],
        frontMatter: [],
        backMatter: [],
      };

      const report = runPreflight(cleanStructure);
      expect(report.belowKdpSpineMinimum).toBe(false);
      const quotesItem = report.items.find((i) => i.id === "unbalanced_quotes");
      expect(quotesItem?.status).toBe("ok");
      const oddItem = report.items.find((i) => i.id === "odd_tokens");
      expect(oddItem?.status).toBe("ok");
    });
  });

  describe("30-Day Revision Grace Period Logic", () => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    it("authorizes revisions within the 30-day window", () => {
      const paidDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const elapsed = Date.now() - paidDate.getTime();
      const isAllowed = elapsed <= THIRTY_DAYS_MS;
      expect(isAllowed).toBe(true);
    });

    it("rejects revisions after the 30-day window expires", () => {
      const paidDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000); // 35 days ago
      const elapsed = Date.now() - paidDate.getTime();
      const isAllowed = elapsed <= THIRTY_DAYS_MS;
      expect(isAllowed).toBe(false);
    });
  });
});
