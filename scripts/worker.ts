// Dedicated queue worker for deployments that split web and job processing
// (e.g. a second Fly/Railway service). The default production path embeds the
// same consumer inside the Next server via instrumentation.ts — this script is
// only needed when RACANA_EMBEDDED_WORKER=false on the web service.
//
//   npm run worker            (bundles to dist/worker.cjs, then runs it)
//
// Requires the same env as the app: DATABASE_URL, REDIS_URL, S3_*, RACANA_ROOT.
// When PORT is set, serves GET /health for platform health checks.
import http from "http";
import { startEmbeddedWorker } from "../src/lib/queue/worker";
import { redisConnection } from "../src/lib/queue/queue";
import { assertWorkerEnv } from "../src/lib/env-check";
import { checkStorageHealth } from "../src/lib/storage/s3";

if (process.env.NODE_ENV === "production") {
  assertWorkerEnv();
}

const worker = startEmbeddedWorker();
if (!worker) {
  console.error("[worker] Could not start — REDIS_URL unreachable?");
  process.exit(1);
}

console.log("[worker] Racana book-processing worker started (queue: book-processing)");

const port = Number(process.env.PORT);
const server = port
  ? http
      .createServer(async (req, res) => {
        if (req.url !== "/health") {
          res.writeHead(404).end();
          return;
        }
        let storage = "ok";
        try {
          await checkStorageHealth();
        } catch {
          storage = "degraded";
        }
        const redisReady = redisConnection?.status === "ready";
        const ok = worker.isRunning() && redisReady && storage === "ok";
        res.writeHead(ok ? 200 : 503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ok,
          redis: redisReady ? "ok" : redisConnection?.status ?? "none",
          storage,
        }));
      })
      .listen(port, () => console.log(`[worker] health check on :${port}/health`))
  : null;

// Keep the process alive.
setInterval(() => {}, 60_000);

process.on("SIGTERM", async () => {
  server?.close();
  await worker.close().catch(() => {});
  process.exit(0);
});
