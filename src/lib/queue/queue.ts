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

export async function addJobToQueue(jobId: string, payload: Record<string, unknown> = {}) {
  try {
    // Only attempt BullMQ when Redis is actually connected — queue.add() waits
    // on the connection indefinitely otherwise, and the job would never start.
    if (bookQueue && redisConnection && redisConnection.status === "ready") {
      await Promise.race([
        bookQueue.add("process-book", { jobId, ...payload }, {
          attempts: 2,
          backoff: { type: "exponential", delay: 1000 },
          removeOnComplete: true,
          removeOnFail: 100, // keep last 100 failed jobs for debugging
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("queue add timed out")), 5000)
        ),
      ]);
      // Ensure this process consumes the queue — an enqueued job with no
      // consumer would stall forever. Lazy start keeps test/offline runs clean;
      // RACANA_EMBEDDED_WORKER=false when a dedicated worker process exists.
      if (process.env.RACANA_EMBEDDED_WORKER !== "false") {
        const { startEmbeddedWorker } = await import("./worker");
        startEmbeddedWorker();
      }
      return { success: true, queuedWith: "bullmq" };
    }
  } catch (err) {
    console.warn("[Queue] BullMQ dispatch failed, will run in-process worker:", (err as Error).message);
  }

  // In-process fallback: trigger worker directly asynchronously.
  // The setTimeout import can fail if the worker module is broken — in that
  // case we return { success: false } so the caller can surface an error
  // instead of leaving the job stuck at "analyzing"/"queued" forever.
  const task = (payload.task as string) || "render";
  let dispatchFailed = false;
  setTimeout(() => {
    import("./worker").then(({ processBookJob, runAnalysisTask }) => {
      const run = task === "analyze" ? runAnalysisTask : processBookJob;
      run(jobId).catch((e) => console.error("Worker error:", e));
    }).catch((e) => {
      console.error("[Queue] In-process worker import failed:", e);
      dispatchFailed = true;
    });
  }, 100);

  // If the import fails synchronously (unlikely but possible), the flag is
  // already set.  Otherwise the job is in-flight.
  if (dispatchFailed) {
    return { success: false, queuedWith: "in-process", error: "Worker module failed to load" };
  }

  return { success: true, queuedWith: "in-process" };
}
