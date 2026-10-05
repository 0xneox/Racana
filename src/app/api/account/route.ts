import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { revokeSessionToken } from "@/lib/auth/session-store";
import { GENERIC_INTERNAL_ERROR, logServerError, requireSession } from "@/lib/auth-utils";
import { deleteJobEverywhere } from "@/lib/jobs/delete";

// Account deletion — removes the user, every book job they own (files and
// rendered artifacts included), and all sessions. Payments and email logs
// keep their SetNull audit trail. Signed-in users only; guests can delete
// individual jobs instead.
export async function DELETE(request: NextRequest) {
  try {
    const { user, error } = await requireSession();
    if (error) return error;

    const jobs = await prisma.bookJob.findMany({
      where: { userId: user!.id },
      select: { id: true },
    });
    for (const job of jobs) {
      try {
        await deleteJobEverywhere(job.id);
      } catch (jobErr) {
        logServerError("Account DELETE job cleanup", jobErr);
      }
    }

    // Sessions cascade with the user row; payments/email logs SetNull.
    await prisma.user.delete({ where: { id: user!.id } });

    await revokeSessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value).catch(() => {});
    const response = NextResponse.json({ success: true });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  } catch (err) {
    logServerError("Account DELETE API", err);
    return NextResponse.json({ error: GENERIC_INTERNAL_ERROR }, { status: 500 });
  }
}
