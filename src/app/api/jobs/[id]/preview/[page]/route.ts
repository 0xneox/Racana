import { NextRequest, NextResponse } from "next/server";
import { getFromStorage } from "@/lib/storage/s3";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";

// Streams a rendered preview page PNG for the /ready gallery.
// GET /api/jobs/[id]/preview/1
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; page: string } }
) {
  try {
    const identity = await requireIdentity();

    const ownerRes = await requireJobOwner(params.id, {
      userId: identity.user?.id,
      guestId: identity.guestId,
    });
    if (ownerRes.error) return ownerRes.error;

    const page = parseInt(params.page, 10);
    if (!Number.isInteger(page) || page < 1 || page > 10) {
      return NextResponse.json({ error: "Invalid page." }, { status: 400 });
    }

    const s3Key = `artifacts/${params.id}/preview/page-${page}.png`;
    let png: Buffer;
    try {
      png = await getFromStorage(s3Key, "artifacts");
    } catch {
      return NextResponse.json({ error: "Preview page not available." }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Length": png.length.toString(),
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    logServerError("Jobs Preview API", err);
    return NextResponse.json({ error: GENERIC_INTERNAL_ERROR }, { status: 500 });
  }
}
