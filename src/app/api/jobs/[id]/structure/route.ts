import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";

interface StructureBlock {
  type?: string;
}

interface StructureSection {
  blocks?: StructureBlock[];
}

interface StructureData {
  title?: string;
  subtitle?: string;
  author?: string;
  detectedBookType?: string;
  estimatedPages?: number;
  warnings?: unknown[];
  chapters?: { number?: number; title?: string; wordCount?: number; sections?: StructureSection[] }[];
  frontMatter?: { type?: string; title?: string }[];
  backMatter?: { type?: string; title?: string }[];
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireIdentity();

    const ownerRes = await requireJobOwner(params.id, {
      userId: identity.user?.id,
      guestId: identity.guestId,
    });
    if (ownerRes.error) return ownerRes.error;

    const row = await prisma.bookStructureJSON.findUnique({
      where: { jobId: params.id },
    });

    if (!row || !row.structureData) {
      return NextResponse.json(
        { summary: null, status: "pending" },
        { status: 200 }
      );
    }

    const data = row.structureData as unknown as StructureData;
    const chapters = data.chapters || [];

    let sectionCount = 0;
    let quotationCount = 0;
    for (const ch of chapters) {
      for (const sec of ch.sections || []) {
        if (sec.blocks && sec.blocks.length > 0) sectionCount++;
        for (const b of sec.blocks || []) {
          if (b.type === "quote") quotationCount++;
        }
      }
    }

    return NextResponse.json({
      summary: {
        chapterCount: chapters.length,
        sectionCount,
        quotationCount,
        warningCount: Array.isArray(data.warnings) ? data.warnings.length : 0,
        detectedBookType: data.detectedBookType || row.detectedBookType || null,
        detectedTitle: data.title || row.detectedTitle || null,
        detectedAuthor: data.author || row.detectedAuthor || null,
        detectedScript: (data as any).detectedScript || null,
        scriptLabel: (data as any).scriptLabel || null,
        estimatedPages: data.estimatedPages || 0,
        chapters: chapters.map((ch, i) => ({
          index: i,
          number: ch.number ?? i + 1,
          title: ch.title || `Chapter ${ch.number ?? i + 1}`,
          wordCount: ch.wordCount || 0,
        })),
        frontMatter: (data.frontMatter || []).map((f) => f.title || f.type),
        backMatter: (data.backMatter || []).map((b) => b.title || b.type),
      },
      status: "ready",
    });
  } catch (err) {
    logServerError("Structure GET API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}

// Lets the author correct detected chapter titles (and the book title/author)
// before typesetting. Only editable while the job hasn't entered the render
// pipeline — once typesetting starts, structure is frozen.
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const identity = await requireIdentity();

    const ownerRes = await requireJobOwner(params.id, {
      userId: identity.user?.id,
      guestId: identity.guestId,
    });
    if (ownerRes.error) return ownerRes.error;

    const job = await prisma.bookJob.findUnique({
      where: { id: params.id },
      select: { status: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    const lockedStatuses = ["queued", "typesetting", "qa", "fixing", "ready"];
    if (lockedStatuses.includes(job.status)) {
      return NextResponse.json(
        { error: "This book is already being typeset — structure can no longer be edited." },
        { status: 409 }
      );
    }

    const row = await prisma.bookStructureJSON.findUnique({
      where: { jobId: params.id },
    });
    if (!row || !row.structureData) {
      return NextResponse.json(
        { error: "No detected structure to edit yet." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = row.structureData as unknown as StructureData;
    const chapters = Array.isArray(data.chapters) ? [...data.chapters] : [];

    if (Array.isArray(body.chapters)) {
      for (const edit of body.chapters) {
        const idx = Number(edit?.index);
        if (!Number.isInteger(idx) || idx < 0 || idx >= chapters.length) continue;
        const title = String(edit?.title ?? "").trim().slice(0, 200);
        if (title) {
          chapters[idx] = { ...chapters[idx], title };
        }
      }
      data.chapters = chapters;
    }

    if (typeof body.title === "string" && body.title.trim()) {
      data.title = body.title.trim().slice(0, 200);
    }
    if (typeof body.author === "string") {
      data.author = body.author.trim().slice(0, 120) || undefined;
    }

    await prisma.bookStructureJSON.update({
      where: { jobId: params.id },
      data: {
        structureData: data as any,
        detectedTitle: data.title || row.detectedTitle,
        detectedAuthor: data.author || row.detectedAuthor,
        chapterCount: chapters.length,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    logServerError("Structure PATCH API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
