import { NextRequest, NextResponse } from "next/server";
import { analyzeManuscript } from "@/lib/ai/analyzer";
import { runPreflight } from "@/lib/renderer/preflight";
import { validateManuscript } from "@/lib/manuscript/validator";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { logServerError } from "@/lib/auth-utils";
import type { BookStructureV1, Block } from "@/lib/manuscript/types";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const limit = await rateLimit(`preflight_audit:${ip}`, 30, 60 * 60 * 1000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Audit rate limit reached. Please try again in a few minutes." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    let structure: BookStructureV1;
    let fileName = "sample.docx";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const text = formData.get("text") as string | null;

      if (file) {
        fileName = file.name;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const validation = validateManuscript(buffer, file.name, file.type);
        if (!validation.valid) {
          return NextResponse.json({ error: validation.error }, { status: 422 });
        }

        structure = await analyzeManuscript(buffer, validation.mimeType, file.name);
      } else if (text && text.trim().length > 0) {
        structure = buildStructureFromText(text);
      } else {
        return NextResponse.json(
          { error: "Please upload a .docx/.pdf file or paste manuscript text." },
          { status: 400 }
        );
      }
    } else {
      const body = await request.json().catch(() => ({}));
      const text = (body.text as string) || "";
      if (!text.trim()) {
        return NextResponse.json(
          { error: "No manuscript text provided." },
          { status: 400 }
        );
      }
      structure = buildStructureFromText(text, body.title, body.author);
    }

    const preflight = runPreflight(structure);

    // Calculate overall health score out of 100
    let score = 100;
    for (const item of preflight.items) {
      if (item.status === "check") {
        if (item.id === "odd_tokens") score -= 15;
        else if (item.id === "unbalanced_quotes") score -= 12;
        else if (item.id === "truncated_sentences") score -= 10;
        else if (item.id === "low_confidence_headings") score -= 8;
        else if (item.id === "long_paragraphs") score -= 5;
        else if (item.id === "page_count") score -= 5;
        else score -= 5;
      }
    }
    score = Math.max(20, Math.min(100, score));

    let grade = "A+";
    let verdict = "Bookstore Print-Ready";
    if (score >= 95) {
      grade = "A+";
      verdict = "Perfect Bookstore Grade";
    } else if (score >= 88) {
      grade = "A";
      verdict = "Excellent Print Quality — Minor advisories";
    } else if (score >= 75) {
      grade = "B";
      verdict = "Good — Recommended fixes before press";
    } else {
      grade = "C";
      verdict = "Formatting Attention Needed";
    }

    const wordCount = (structure.chapters || []).reduce(
      (acc, ch) => acc + (ch.wordCount || 0),
      0
    );

    return NextResponse.json({
      success: true,
      fileName,
      healthScore: score,
      grade,
      verdict,
      stats: {
        title: structure.title || fileName.replace(/\.[^/.]+$/, ""),
        author: structure.author || "Unknown Author",
        chapterCount: structure.chapterCount || structure.chapters?.length || 1,
        wordCount,
        estimatedPages: preflight.estimatedPages,
      },
      preflight,
    });
  } catch (err) {
    logServerError("Preflight Audit API", err);
    return NextResponse.json(
      { error: "Could not analyze manuscript. Please check file format." },
      { status: 500 }
    );
  }
}

function buildStructureFromText(text: string, title?: string, author?: string): BookStructureV1 {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const blocks: Block[] = paragraphs.map((p) => {
    // Basic heading detection for pasted text
    if (/^(chapter\s+\w+|part\s+\w+|prologue|epilogue)/i.test(p) || (p.length < 50 && p === p.toUpperCase())) {
      return { type: "heading_h1", text: p, confidence: 0.9 };
    }
    return { type: "paragraph", text: p };
  });

  const totalWords = text.trim().split(/\s+/).filter(Boolean).length;
  const estimatedPages = Math.max(1, Math.ceil(totalWords / 275));

  return {
    schemaVersion: 1,
    title: title || "Manuscript Sample",
    author: author || undefined,
    warnings: [],
    detectedBookType: "novel",
    estimatedPages,
    chapterCount: 1,
    chapters: [
      {
        number: 1,
        title: "Sample Chapter",
        wordCount: totalWords,
        sections: [{ title: "", blocks }],
      },
    ],
    frontMatter: [],
    backMatter: [],
  };
}
