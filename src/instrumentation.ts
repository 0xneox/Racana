// Runs once per Node.js server process at boot (including the standalone
// production server). Fails fast when required production env vars are
// missing — better to refuse to boot than serve a broken app.
//
// NOTE: this file is also compiled for the edge runtime — keep imports free of
// Node builtins. The BullMQ consumer is started lazily by addJobToQueue()
// (src/lib/queue/queue.ts) the first time a job is enqueued, or by
// scripts/worker.ts in dedicated-worker deployments.
export async function register() {
  // register() also executes during `next build` — env asserts must only run
  // on a live server, never in the build pipeline.
  const phase = process.env.NEXT_PHASE;
  if (phase !== "phase-production-server" && phase !== "phase-development-server") {
    return;
  }
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  if (process.env.NODE_ENV === "production") {
    const { assertProductionEnv } = await import("./lib/env-check");
    assertProductionEnv();
  }

  // Fail stale processing jobs so the author can safely retry them. Queued
  // jobs get a longer grace period because a healthy worker may be draining
  // a backlog.
  try {
    const prisma = (await import("./lib/db")).default;
    const stuckThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const result = await prisma.bookJob.updateMany({
      where: {
        status: { in: ["analyzing", "typesetting", "qa", "fixing"] },
        updatedAt: { lt: stuckThreshold },
      },
      data: {
        status: "failed",
        errorMessage: "Processing was interrupted. Please try again.",
        currentStep: "Processing interrupted",
      },
    });
    const queuedThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const staleQueued = await prisma.bookJob.updateMany({
      where: {
        status: "queued",
        updatedAt: { lt: queuedThreshold },
      },
      data: {
        status: "failed",
        errorMessage: "Processing could not be started. Please try again.",
        currentStep: "Queue retry required",
      },
    });
    const failedCount = result.count + staleQueued.count;
    if (failedCount > 0) {
      console.log(`[Startup] Reconciled ${failedCount} stale jobs to 'failed'`);
    }
  } catch (err) {
    console.warn("[Startup] Orphan reconciliation failed:", (err as Error).message);
  }
}
