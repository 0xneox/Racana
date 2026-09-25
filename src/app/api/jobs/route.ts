import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { GENERIC_INTERNAL_ERROR, logServerError, requireIdentity } from "@/lib/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const identity = await requireIdentity();
    const userId = identity.user?.id || "__none__";
    const guestId = identity.user ? "__none__" : identity.guestId || "__none__";

    const jobs = await prisma.bookJob.findMany({
      where: { OR: [{ userId }, { guestId }] },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        manuscriptAsset: { select: { fileName: true, pageCountEstimate: true } },
        templateChoice: { select: { name: true, personality: true } },
      },
    });

    return NextResponse.json({ jobs });
  } catch (err) {
    logServerError("Jobs List API", err);
    return NextResponse.json(
      { error: GENERIC_INTERNAL_ERROR },
      { status: 500 }
    );
  }
}
