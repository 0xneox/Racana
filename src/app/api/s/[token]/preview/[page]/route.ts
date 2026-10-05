import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getFromStorage } from "@/lib/storage/s3";
import { GENERIC_INTERNAL_ERROR, logServerError } from "@/lib/auth-utils";

// Streams a rendered preview page PNG for a public share link.
// The share token is the authorization — the author opted in by sharing.
// GET /api/s/{token}/preview/1
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string; page: string } }
) {
  try {
    if (!/^[a-f0-9]{24}$/.test(params.token)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const job = await prisma.bookJob.findFirst({
      where: { shareToken: params.token, status: "ready" },
      select: { id: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const page = parseInt(params.page, 10);
    if (!Number.isInteger(page) || page < 1 || page > 10) {
      return NextResponse.json({ error: "Invalid page." }, { status: 400 });
    }

    let png: Buffer;
    try {
      png = await getFromStorage(`artifacts/${job.id}/preview/page-${page}.png`, "artifacts");
    } catch {
      return NextResponse.json({ error: "Preview page not available." }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": png.length.toString(),
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (err) {
    logServerError("Share Preview API", err);
    return NextResponse.json({ error: GENERIC_INTERNAL_ERROR }, { status: 500 });
  }
}
