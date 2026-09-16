import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { BookType, SettingsMode, TemplateKey, TrimSize } from "@prisma/client";
import { GENERIC_INTERNAL_ERROR, logServerError, requireJobOwner, requireSession } from "@/lib/auth-utils";

const TRIM_SIZES = new Set<string>(Object.values(TrimSize));
const TEMPLATE_KEYS = new Set<string>(Object.values(TemplateKey));
const BOOK_TYPES = new Set<string>(Object.values(BookType));
const PAGE_NUMBER_CHOICES = new Set(["bottom_center", "outer_header"]);
const MODE_CHOICES = new Set<string>(Object.values(SettingsMode));

const ALLOWED_BOOK_SETTINGS_FIELDS: Record<string, (v: any) => any> = {
  fontBody: (v) => (typeof v === "string" && v.length <= 120 ? v : undefined),
  fontHeading: (v) => (typeof v === "string" && v.length <= 120 ? v : undefined),
  fontSizePt: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 6 && n <= 36 ? n : undefined;
  },
  lineHeight: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 1 && n <= 3 ? n : undefined;
  },
  marginTopMm: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
  },
  marginBottomMm: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
  },
  marginInsideMm: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
  },
  marginOutsideMm: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : undefined;
  },
  pageNumbers: (v) => (typeof v === "string" && PAGE_NUMBER_CHOICES.has(v) ? v : undefined),
  runningHeaders: (v) => (typeof v === "boolean" ? v : undefined),
  chapterOpenRecto: (v) => (typeof v === "boolean" ? v : undefined),
  bleed: (v) => (typeof v === "boolean" ? v : undefined),
  bleedSizeMm: (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 20 ? n : undefined;
  },
  mode: (v) => (typeof v === "string" && MODE_CHOICES.has(v) ? (v as SettingsMode) : undefined),
};

function filterBookSettings(input: any): { [k: string]: any } {
  const out: { [k: string]: any } = {};
  if (!input || typeof input !== "object") return out;
  for (const key of Object.keys(ALLOWED_BOOK_SETTINGS_FIELDS)) {
    if (!(key in input)) continue;
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
    const { user, error } = await requireSession();
    if (error) return error;

    const ownerRes = await requireJobOwner(params.id, user!.id);
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
          select: { id: true, status: true, amountCents: true, currency: true, createdAt: true },
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
    const { user, error } = await requireSession();
    if (error) return error;

    const ownerRes = await requireJobOwner(params.id, user!.id);
    if (ownerRes.error) return ownerRes.error;

    const body = await request.json();
    const { templateKey, trimSize, bookType, settings } = body || {};

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

    if (templateKey && TEMPLATE_KEYS.has(String(templateKey))) {
      const templateMeta: Record<string, { name: string; personality: string; description: string }> = {
        classic: {
          name: "Classic",
          personality: "Timeless Literary",
          description: "Traditional Garamond typography with elegant drop caps and classic running headers.",
        },
        modern: {
          name: "Modern",
          personality: "Clean Minimal",
          description: "Crisp sans/serif blend, generous whitespace, asymmetrical chapter titles.",
        },
        philosophy: {
          name: "Philosophy",
          personality: "Spacious Contemplative",
          description: "Generous margins for contemplative breathing room and subtle section dividers.",
        },
        academic: {
          name: "Academic",
          personality: "Structured Scholarly",
          description: "Rigorous hierarchy, footnote-friendly formatting, and clear folio layout.",
        },
        literary: {
          name: "Literary",
          personality: "Elegant Bookstore",
          description: "Deep typography, deckle-edge feel, and poetic rhythm for fiction & memoirs.",
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
    const filteredSettings = filterBookSettings(settings);

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

    const updatedJob = await prisma.bookJob.findUnique({
      where: { id: params.id },
      include: {
        templateChoice: true,
        settings: true,
        manuscriptAsset: true,
      },
    });

    return NextResponse.json({ success: true, job: updatedJob });
  } catch (err) {
    logServerError("Jobs PATCH API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
