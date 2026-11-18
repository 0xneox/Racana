import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { BookType, SettingsMode, TemplateKey, TrimSize } from "@prisma/client";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";
import { EMBEDDED_FONT_FAMILIES } from "@/lib/templates/engine";
import { deleteJobEverywhere } from "@/lib/jobs/delete";

const TRIM_SIZES = new Set<string>(Object.values(TrimSize));
// Launch catalogue — only the audited templates can be selected for new
// renders. The engine still renders the others for jobs that already carry
// them, but they are not offered or accepted here.
const TEMPLATE_KEYS = new Set<string>([TemplateKey.classic, TemplateKey.modern]);
const BOOK_TYPES = new Set<string>(Object.values(BookType));
const PAGE_NUMBER_CHOICES = new Set(["bottom_center", "outer_header"]);
const MODE_CHOICES = new Set<string>(Object.values(SettingsMode));

// KDP never accepts less than 0.25″ (6.35mm) on any edge.
function marginMm(v: unknown, min = 6.35): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= 100 ? n : undefined;
}

const ALLOWED_BOOK_SETTINGS_FIELDS: Record<string, (v: any) => any> = {
  fontBody: (v) => (typeof v === "string" && EMBEDDED_FONT_FAMILIES.has(v) ? v : undefined),
  fontHeading: (v) => (typeof v === "string" && EMBEDDED_FONT_FAMILIES.has(v) ? v : undefined),
  fontSizePt: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 6 && n <= 36 ? n : undefined;
  },
  lineHeight: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 && n <= 3 ? n : undefined;
  },
  marginTopMm: (v) => marginMm(v),
  marginBottomMm: (v) => marginMm(v),
  // The gutter floor is KDP's minimum for the shortest books; print QA
  // enforces the page-count-dependent minimum after layout.
  marginInsideMm: (v) => marginMm(v, 9.525),
  marginOutsideMm: (v) => marginMm(v),
  pageNumbers: (v) => (typeof v === "string" && PAGE_NUMBER_CHOICES.has(v) ? v : undefined),
  runningHeaders: (v) => (typeof v === "boolean" ? v : undefined),
  chapterOpenRecto: (v) => (typeof v === "boolean" ? v : undefined),
  includeColophon: (v) => (typeof v === "boolean" ? v : undefined),
  bleed: (v) => (typeof v === "boolean" ? v : undefined),
  bleedSizeMm: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 20 ? n : undefined;
  },
  mode: (v) => (typeof v === "string" && MODE_CHOICES.has(v) ? (v as SettingsMode) : undefined),
};

// Style overrides: NULL means "use the template's value". Sending null clears
// an override; switching template clears all of them so the new template's
// own fonts, leading, margins and folio style take effect.
const STYLE_OVERRIDE_FIELDS = [
  "fontBody",
  "fontHeading",
  "fontSizePt",
  "lineHeight",
  "marginTopMm",
  "marginBottomMm",
  "marginInsideMm",
  "marginOutsideMm",
  "pageNumbers",
  "runningHeaders",
  "chapterOpenRecto",
] as const;

function filterBookSettings(input: any): { [k: string]: any } {
  const out: { [k: string]: any } = {};
  if (!input || typeof input !== "object") return out;
  for (const key of Object.keys(ALLOWED_BOOK_SETTINGS_FIELDS)) {
    if (!(key in input)) continue;
    if (input[key] === null && (STYLE_OVERRIDE_FIELDS as readonly string[]).includes(key)) {
      out[key] = null;
      continue;
    }
    const coerced = ALLOWED_BOOK_SETTINGS_FIELDS[key](input[key]);
    if (coerced !== undefined) out[key] = coerced;
  }
  return out;
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

    const job = await prisma.bookJob.findUnique({
      where: { id: params.id },
      include: {
        manuscriptAsset: true,
        templateChoice: true,
        settings: true,
        artifacts: true,
        qaReports: true,
        structureJson: true,
        payments: {
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, amountCents: true, currency: true, createdAt: true, updatedAt: true },
        },
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json({ job });
  } catch (err) {
    logServerError("Jobs GET API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    const { templateKey, trimSize, bookType, settings } = body || {};

    const existingJob = await prisma.bookJob.findUnique({
      where: { id: params.id },
      select: { status: true, trimSize: true },
    });
    if (!existingJob) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    const jobData: Record<string, unknown> = {};
    if (bookType && BOOK_TYPES.has(String(bookType))) {
      jobData.bookType = bookType as BookType;
    }
    if (trimSize && TRIM_SIZES.has(String(trimSize))) {
      jobData.trimSize = trimSize as TrimSize;
    }

    if (Object.keys(jobData).length > 0) {
      await prisma.bookJob.update({
        where: { id: params.id },
        data: jobData,
      });
    }

    let templateChanged = false;
    if (templateKey && TEMPLATE_KEYS.has(String(templateKey))) {
      const current = await prisma.templateChoice.findUnique({ where: { jobId: params.id } });
      templateChanged = current?.templateKey !== templateKey;
      const templateMeta: Record<string, { name: string; personality: string; description: string }> = {
        classic: {
          name: "Classic",
          personality: "Timeless Literary",
          description: "EB Garamond throughout, centred chapter openers with a small-caps chapter number, italic running heads, folios at the foot.",
        },
        modern: {
          name: "Modern",
          personality: "Clean Minimal",
          description: "Source Serif body with Source Sans headings, left-aligned openers with an oversized chapter numeral, block paragraphs, folios in the outer header.",
        },
        philosophy: {
          name: "Philosophy",
          personality: "Spacious Contemplative",
          description: "Libre Baskerville with wide margins, subtle section markers, generous line-height, refined proportion for contemplative writing.",
        },
        academic: {
          name: "Academic",
          personality: "Structured Scholarly",
          description: "Source Serif 4 throughout, rigorous heading hierarchy, footnote-friendly layout, formal folios, disciplined spacing for research & technical works.",
        },
        literary: {
          name: "Literary",
          personality: "Elegant Bookstore",
          description: "Libre Baskerville with deep typographic typography, deckle-edge feel, poetic rhythm for distinctive literary voices.",
        },
        indian: {
          name: "Indian Classical",
          personality: "Traditional Ornamental",
          description: "Noto Serif Devanagari / Tamil / Malayalam ready, traditional ornamental flourishes and classical typography for Indian-language books.",
        },
      };

      const meta = templateMeta[templateKey] || templateMeta.classic;

      await prisma.templateChoice.upsert({
        where: { jobId: params.id },
        create: {
          jobId: params.id,
          templateKey: templateKey as TemplateKey,
          name: meta.name,
          personality: meta.personality,
          description: meta.description,
        },
        update: {
          templateKey: templateKey as TemplateKey,
          name: meta.name,
          personality: meta.personality,
          description: meta.description,
        },
      });
    }

    const finalTrimSize = trimSize && TRIM_SIZES.has(String(trimSize))
      ? (trimSize as TrimSize)
      : undefined;
    const filteredSettings = {
      ...(templateChanged ? Object.fromEntries(STYLE_OVERRIDE_FIELDS.map((k) => [k, null])) : {}),
      ...filterBookSettings(settings),
    };

    if (finalTrimSize || Object.keys(filteredSettings).length > 0) {
      const createData: Record<string, any> = {};
      const updateData: Record<string, any> = {};

      if (finalTrimSize) {
        createData.trimSize = finalTrimSize;
        updateData.trimSize = finalTrimSize;
      } else {
        createData.trimSize = TrimSize.trim_6x9;
      }
      Object.assign(createData, filteredSettings);
      Object.assign(updateData, filteredSettings);

      await prisma.bookSettings.upsert({
        where: { jobId: params.id },
        create: createData as any,
        update: updateData as any,
      });
    }

    // A rendered book whose interior-affecting settings changed now disagrees
    // with its own artifacts: the cover was built for the old trim/spine and
    // the EPUB embeds the old layout. Drop them so nothing stale is served —
    // the interior itself re-renders via /start {regenerate:true}.
    const interiorChanged =
      templateChanged ||
      (trimSize !== undefined && trimSize !== existingJob.trimSize) ||
      Object.keys(filteredSettings).some((k) => k !== "mode");
    if (existingJob.status === "ready" && interiorChanged) {
      await prisma.renderArtifact.deleteMany({
        where: {
          jobId: params.id,
          artifactType: { in: ["cover_pdf", "cover_png", "cover_ebook_jpg", "epub"] },
        },
      });
    }

    const updatedJob = await prisma.bookJob.findUnique({
      where: { id: params.id },
      include: {
        templateChoice: true,
        settings: true,
        manuscriptAsset: true,
      },
    });

    return NextResponse.json({
      success: true,
      job: updatedJob,
      interiorStale: existingJob.status === "ready" && interiorChanged,
    });
  } catch (err) {
    logServerError("Jobs PATCH API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}

// Deletes the book and everything it produced — manuscript file, rendered
// PDFs, previews, cover files, structure and settings. Owner only.
export async function DELETE(
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

    // Never pull a job out from under the renderer mid-flight.
    const job = await prisma.bookJob.findUnique({
      where: { id: params.id },
      select: { status: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (["analyzing", "queued", "typesetting", "qa", "fixing"].includes(job.status)) {
      return NextResponse.json(
        { error: "This book is still being generated — try again once it finishes." },
        { status: 409 }
      );
    }

    await deleteJobEverywhere(params.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    logServerError("Jobs DELETE API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
