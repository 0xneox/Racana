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
}
