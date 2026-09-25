// Dedicated queue worker for deployments that split web and job processing
// (e.g. a second Fly/Railway service). The default production path embeds the
// same consumer inside the Next server via instrumentation.ts — this script is
// only needed when RACANA_EMBEDDED_WORKER=false on the web service.
//
//   npm run worker
//
// Requires the same env as the app: DATABASE_URL, REDIS_URL, S3_*, RACANA_ROOT.
import { startEmbeddedWorker } from "../src/lib/queue/worker";

const worker = startEmbeddedWorker();
if (!worker) {
  console.error("[worker] Could not start — REDIS_URL unreachable?");
  process.exit(1);
}

console.log("[worker] Racana book-processing worker started (queue: book-processing)");

// Keep the process alive.
setInterval(() => {}, 60_000);

process.on("SIGTERM", async () => {
  await worker.close().catch(() => {});
  process.exit(0);
});
