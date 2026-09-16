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

  bookQueue = new Queue("book-processing", {
    connection: redisConnection,
  });
} catch (e) {
  console.warn("[BullMQ] Failed to initialize queue with Redis:", (e as Error).message);
}

export { redisConnection, bookQueue };

export async function addJobToQueue(jobId: string, payload: Record<string, unknown> = {}) {
  try {
    if (bookQueue) {
      await bookQueue.add("process-book", { jobId, ...payload }, {
        attempts: 2,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
      });
      return { success: true, queuedWith: "bullmq" };
    }
  } catch (err) {
    console.warn("[Queue] BullMQ dispatch failed, will run in-process worker:", (err as Error).message);
  }

  // In-process fallback: trigger worker directly asynchronously
  setTimeout(() => {
    import("./worker").then(({ processBookJob }) => {
      processBookJob(jobId).catch((e) => console.error("Worker error:", e));
    });
  }, 100);

  return { success: true, queuedWith: "in-process" };
}
