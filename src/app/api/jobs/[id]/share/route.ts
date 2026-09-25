import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/db";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";
import { getAppUrl } from "@/lib/env";

// Mints (or returns the existing) public share token for a finished book.
// Opt-in only: nothing is publicly reachable until the author asks for a link.
export async function POST(
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
      select: { id: true, status: true, shareToken: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (job.status !== "ready") {
      return NextResponse.json(
        { error: "Share link unlocks once your book is ready." },
        { status: 400 }
      );
    }

    let shareToken = job.shareToken;
    if (!shareToken) {
      shareToken = crypto.randomBytes(12).toString("hex");
      await prisma.bookJob.update({
        where: { id: job.id },
        data: { shareToken },
      });
    }

    return NextResponse.json({
      success: true,
      shareToken,
      shareUrl: `${getAppUrl()}/s/${shareToken}`,
    });
  } catch (err) {
    logServerError("Share API", err);
    return NextResponse.json({ error: GENERIC_INTERNAL_ERROR }, { status: 500 });
  }
}
