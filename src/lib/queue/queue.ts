import { Queue } from "bullmq";
import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

let redisConnection: Redis | null = null;
let bookQueue: Queue | null = null;

try {
  redisConnection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      // Production must reconnect forever: a managed-Redis idle disconnect
      // would otherwise leave the worker alive but deaf to the queue.
      if (process.env.NODE_ENV === "production") return Math.min(times * 500, 5000);
      if (times > 3) return null; // stop retrying quickly in test/offline modes
      return Math.min(times * 100, 1000);
    },
  });

  redisConnection.on("error", (err) => {
    // Suppress unhandled redis errors when running offline/unit tests
    if (process.env.NODE_ENV !== "production") {
      // console.warn("[Redis] connection error:", err.message);
    }
  });

  // Under vitest the open socket keeps the process alive and crashes teardown —
  // unref lets the test runner exit cleanly once assertions finish.
  if (process.env.VITEST === "true") {
    const rc = redisConnection as any;
    rc.unref?.();
    (rc.stream || rc.connector?.stream)?.unref?.();
  }

  bookQueue = new Queue("book-processing", {
    connection: redisConnection,
  });
} catch (e) {
  console.warn("[BullMQ] Failed to initialize queue with Redis:", (e as Error).message);
}

export { redisConnection, bookQueue };

const inProcessJobs: Set<string> =
  (globalThis as any).__racanaInProcessJobs || new Set<string>();
(globalThis as any).__racanaInProcessJobs = inProcessJobs;

export async function addJobToQueue(jobId: string, payload: Record<string, unknown> = {}) {
  const task = (payload.task as string) || "render";
  const queueJobId = `racana-${task}-${jobId}`;

  try {
    // Only attempt BullMQ when Redis is actually connected — queue.add() waits
    // on the connection indefinitely otherwise, and the job would never start.
    if (bookQueue && redisConnection && redisConnection.status === "ready") {
      if (process.env.RACANA_EMBEDDED_WORKER !== "false" && process.env.VITEST !== "true") {
        const { startEmbeddedWorker } = await import("./worker");
        if (!startEmbeddedWorker()) throw new Error("Embedded worker could not start");
      }

      const existing = await bookQueue.getJob(queueJobId);
      if (existing) {
        const state = await existing.getState();
        if (state !== "failed") {
          return { success: true, queuedWith: "bullmq" as const };
        }
        await existing.remove();
      }

      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          bookQueue.add("process-book", { jobId, ...payload }, {
            jobId: queueJobId,
            attempts: 2,
            backoff: { type: "exponential", delay: 1000 },
            removeOnComplete: true,
            removeOnFail: 100,
          }),
          new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error("queue add timed out")), 5000);
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }
      // The embedded consumer is started before adding the item; dedicated
      // worker deployments disable it on the web service.
      return { success: true, queuedWith: "bullmq" };
    }
  } catch (err) {
    console.warn("[Queue] BullMQ dispatch failed:", (err as Error).message);
  }

  // Dedicated-worker deploys must not silently typeset on the web process
  // (Vercel 60s limit, Fly web RAM). Fail so the author can retry.
  if (process.env.RACANA_EMBEDDED_WORKER === "false") {
    return { success: false, queuedWith: "bullmq", error: "Queue unavailable" };
  }

  // In-process fallback: load the worker before acknowledging dispatch, then
  // trigger it asynchronously.
  let worker: typeof import("./worker");
  try {
    worker = await import("./worker");
  } catch (err) {
    console.error("[Queue] In-process worker import failed:", err);
    return { success: false, queuedWith: "in-process", error: "Worker module failed to load" };
  }

  const inProcessKey = `${task}:${jobId}`;
  if (inProcessJobs.has(inProcessKey)) {
    return { success: true, queuedWith: "in-process" as const };
  }
  inProcessJobs.add(inProcessKey);

  setTimeout(() => {
    const run = task === "analyze" ? worker.runAnalysisTask : worker.processBookJob;
    run(jobId)
      .catch((e) => console.error("Worker error:", e))
      .finally(() => inProcessJobs.delete(inProcessKey));
  }, 100);

  return { success: true, queuedWith: "in-process" };
}
