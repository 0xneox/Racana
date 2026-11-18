import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import {
  generateCoverSvg,
  stripCoverPlaceholders,
  validIsbn13,
  COVER_PRESETS,
  type CoverDesignConfig,
} from "../src/lib/cover/generator";
import { generateCoverPdf } from "../src/lib/cover/pdf-fallback";
import { getEffectiveSettings, getTemplate } from "../src/lib/templates/engine";
import { generateTypstSource } from "../src/lib/renderer/typst/generator";
import { generatePublication } from "../src/lib/renderer/publication-renderer";
import { analyzeManuscript } from "../src/lib/ai/analyzer";
import { assertProductionEnv } from "../src/lib/env-check";

// A settings row as created on upload once style fields became overrides.
const FRESH_ROW = {
  trimSize: "trim_6x9", fontBody: null, fontHeading: null, fontSizePt: null, lineHeight: null,
  marginTopMm: null, marginBottomMm: null, marginInsideMm: null, marginOutsideMm: null,
  pageNumbers: null, runningHeaders: null, chapterOpenRecto: null, bleed: false, bleedSizeMm: 3.175,
};

describe("templates keep their own design unless the author overrides it", () => {
  it("Modern with an untouched settings row renders Modern fonts and folios", () => {
    const s = getEffectiveSettings(getTemplate("modern"), "trim_6x9", FRESH_ROW);
    expect(s.body.fontFamily).toBe("Source Serif 4");
    expect(s.heading.fontFamily).toBe("Source Sans 3");
    expect(s.layout.pageNumbersPosition).toBe("outer_header");
    expect(s.layout.chapterOpenRecto).toBe(false);
    expect(s.body.leadingEm).toBe(1.4);
  });

  it("an explicit override still wins", () => {
    const s = getEffectiveSettings(getTemplate("modern"), "trim_6x9", { ...FRESH_ROW, fontBody: "EB Garamond" });
    expect(s.body.fontFamily).toBe("EB Garamond");
    expect(s.heading.fontFamily).toBe("Source Sans 3");
  });
});

describe("interior bleed follows the KDP spec", () => {
  it("adds 0.125″ to the outside edge and top/bottom, keeps the text block in place, passes QA", async () => {
    const buf = fs.readFileSync(path.join(__dirname, "fixtures", "novel_chapters.docx"));
    const structure = await analyzeManuscript(buf, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "novel_chapters.docx");
    const plain = getEffectiveSettings(getTemplate("classic"), "trim_6x9", FRESH_ROW);
    // A custom bleed size is not honoured — KDP only accepts 0.125″.
    const bled = getEffectiveSettings(getTemplate("classic"), "trim_6x9", { ...FRESH_ROW, bleed: true, bleedSizeMm: 10 });

    const src = generateTypstSource({ jobId: "b", structure, settings: bled, templateName: "classic" }).source;
    expect(src).toContain("bleedMm: 3.175");

    const a = await generatePublication({ jobId: "a", structure, settings: plain, templateName: "classic" });
    const b = await generatePublication({ jobId: "b", structure, settings: bled, templateName: "classic" });
    expect(b.qaResult.passed).toBe(true);
    expect(b.qaResult.issues.find((i) => i.code === "TRIM_VERIFIED")).toBeDefined();
    // Same text block relative to trim ⇒ same pagination.
    expect(b.qaResult.pageCount).toBe(a.qaResult.pageCount);

    const { PDFDocument } = await import("pdf-lib");
    const { width, height } = (await PDFDocument.load(b.pdfBuffer)).getPage(0).getSize();
    expect(width).toBeCloseTo(432 + 9, 0);
    expect(height).toBeCloseTo(648 + 18, 0);
  }, 120_000);
});

describe("covers never print invented text", () => {
  const base: CoverDesignConfig = {
    title: "Root Access",
    author: "Binary Bodhi",
    palette: COVER_PRESETS[1].palette,
    typography: COVER_PRESETS[1].typography,
    ornament: "lotus",
    layoutStyle: "centered",
    format: "paperback",
    pageCount: 120,
  };

  it("empty blurb / bio / ISBN / publisher print nothing", () => {
    const svg = generateCoverSvg(base);
    expect(svg).not.toMatch(/ISBN/);
    expect(svg).not.toMatch(/RACANA/i);
    expect(svg).not.toMatch(/extraordinary literary achievement/);
    expect(svg).not.toContain("ABOUT THE AUTHOR");
    expect(svg).not.toContain("PRAISE");
  });

  it("an empty author does not print a stand-in name", () => {
    const svg = generateCoverSvg({ ...base, author: "" });
    expect(svg).not.toMatch(/Author Name/i);
    expect(svg).not.toMatch(/Aryavrat/i);
    expect(svg).toContain("ROOT ACCESS");
  });

  it("an invalid ISBN is never printed; a valid one is", () => {
    expect(generateCoverSvg({ ...base, isbn: "978-93-000000-0-0" })).not.toMatch(/ISBN/);
    expect(generateCoverSvg({ ...base, isbn: "978-0-306-40615-7" })).toContain("ISBN 978-0-306-40615-7");
    expect(validIsbn13("978-0-306-40615-7")).toBe("978-0-306-40615-7");
    expect(validIsbn13("978-0-306-40615-8")).toBeNull();
  });

  it("the barcode area is clear in the export and marked in the studio guides", () => {
    expect(generateCoverSvg(base)).not.toContain("BARCODE");
    expect(generateCoverSvg(base, { showGuides: true })).toContain("KDP BARCODE AREA");
  });

  it("a long bio stops above the barcode area", () => {
    const svg = generateCoverSvg({ ...base, aboutAuthor: "Word ".repeat(1500) });
    const ys = [...svg.matchAll(/<text x="80" y="([\d.]+)"/g)].map((m) => Number(m[1]));
    const dys = (svg.match(/dy="22"/g) || []).length;
    const aboutStart = Math.max(...ys.filter((y) => y < 1020));
    expect(aboutStart + dys * 22).toBeLessThanOrEqual(1020);
  });

  it("strips retired studio placeholders from saved designs", () => {
    const cleaned = stripCoverPlaceholders({
      isbn: "978-93-000000-0-0",
      backBlurb: "A compelling work crafted with timeless typography, rich storytelling, and devotion to the written word.",
      aboutAuthor: "Binary Bodhi is a dedicated storyteller with a passion for literature and cultural heritage.",
      publisher: "Racana Books",
      title: "Root Access",
    });
    expect(cleaned).toMatchObject({ isbn: "", backBlurb: "", aboutAuthor: "", publisher: "", title: "Root Access" });
    const real = { isbn: "978-0-306-40615-7", backBlurb: "My real blurb.", publisher: "Bodhi Press" };
    expect(stripCoverPlaceholders(real)).toEqual(real);
  });

  it("server fallback PDF prints no placeholder ISBN", async () => {
    const pdf = await generateCoverPdf(base);
    expect(pdf.toString("latin1")).not.toContain("978-93");
  });
});

describe("production boot and queue", () => {
  it("refuses to boot without Razorpay and Redis even if auth env is set", () => {
    const keys = [
      "DATABASE_URL",
      "SESSION_SECRET",
      "NEXTAUTH_SECRET",
      "RESEND_API_KEY",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "APP_URL",
      "NEXTAUTH_URL",
      "NEXT_PUBLIC_APP_URL",
      "REDIS_URL",
      "RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET",
      "S3_ENDPOINT",
      "S3_ACCESS_KEY",
      "S3_SECRET_KEY",
    ] as const;
    const saved: Record<string, string | undefined> = {};
    for (const k of keys) {
      saved[k] = process.env[k];
    }
    try {
      process.env.DATABASE_URL = "postgres://local/racana";
      process.env.SESSION_SECRET = "test-session-secret";
      process.env.RESEND_API_KEY = "re_test_example";
      process.env.APP_URL = "https://racana.pro";
      process.env.S3_ENDPOINT = "https://storage.example";
      process.env.S3_ACCESS_KEY = "access-key";
      process.env.S3_SECRET_KEY = "secret-key";
      delete process.env.REDIS_URL;
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      delete process.env.RAZORPAY_WEBHOOK_SECRET;
      expect(() => assertProductionEnv()).toThrow(/RAZORPAY|REDIS/);
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  });

  it("refuses production boot when shared object storage is not configured", () => {
    const saved = {
      DATABASE_URL: process.env.DATABASE_URL,
      SESSION_SECRET: process.env.SESSION_SECRET,
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      APP_URL: process.env.APP_URL,
      NEXTAUTH_URL: process.env.NEXTAUTH_URL,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      REDIS_URL: process.env.REDIS_URL,
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
      RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
      S3_SECRET_KEY: process.env.S3_SECRET_KEY,
    };
    try {
      process.env.DATABASE_URL = "postgres://local/racana";
      process.env.SESSION_SECRET = "test-session-secret";
      process.env.RESEND_API_KEY = "re_test_example";
      process.env.APP_URL = "https://racana.pro";
      process.env.REDIS_URL = "redis://localhost:6379";
      process.env.RAZORPAY_KEY_ID = "rzp_test_example";
      process.env.RAZORPAY_KEY_SECRET = "test-key-secret";
      process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
      delete process.env.S3_ENDPOINT;
      process.env.S3_ACCESS_KEY = "access-key";
      process.env.S3_SECRET_KEY = "secret-key";
      expect(() => assertProductionEnv()).toThrow(/S3_ENDPOINT/);
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it("does not fall back to in-process rendering when a dedicated worker is required", () => {
    const src = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "queue", "queue.ts"), "utf8");
    expect(src).toContain('RACANA_EMBEDDED_WORKER === "false"');
    expect(src).toContain('queuedWith: "bullmq"');
  });
});
