import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity, requireJobOwner } from "@/lib/auth-utils";

// Lightweight status endpoint — returns only status/progress/currentStep/
// errorMessage.  The full GET /api/jobs/[id] includes structureJson (potentially
// MBs of structureData), all artifacts, QA reports, and payments, which is
// wasteful for the /create page that polls every 500ms.
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
      select: {
        id: true,
        status: true,
        progress: true,
        currentStep: true,
        errorMessage: true,
      },
    });

    if (!job) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (err) {
    logServerError("Jobs Status API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
