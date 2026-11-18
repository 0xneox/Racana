import { beforeEach, describe, expect, it, vi } from "vitest";

const queueMocks = vi.hoisted(() => ({
  add: vi.fn(),
  getJob: vi.fn(),
  runAnalysisTask: vi.fn(),
  processBookJob: vi.fn(),
}));

vi.mock("bullmq", () => ({
  Queue: class {
    add(...args: unknown[]) {
      return queueMocks.add(...args);
    }
    getJob(...args: unknown[]) {
      return queueMocks.getJob(...args);
    }
  },
}));

vi.mock("ioredis", () => ({
  default: class {
    status = "ready";
    on() {
      return this;
    }
  },
}));

vi.mock("../src/lib/queue/worker", () => ({
  runAnalysisTask: queueMocks.runAnalysisTask,
  processBookJob: queueMocks.processBookJob,
}));

describe("queue dispatch recovery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("RACANA_EMBEDDED_WORKER", "false");
    queueMocks.add.mockResolvedValue({});
    queueMocks.getJob.mockResolvedValue(null);
    queueMocks.runAnalysisTask.mockResolvedValue(undefined);
    queueMocks.processBookJob.mockResolvedValue(undefined);
  });

  it("uses a stable BullMQ id so retries cannot duplicate a queued render", async () => {
    const queue = await import("../src/lib/queue/queue");
    const result = await queue.addJobToQueue("job-123", { task: "render" });

    expect(result.success).toBe(true);
    expect(queueMocks.add).toHaveBeenCalledWith(
      "process-book",
      { jobId: "job-123", task: "render" },
      expect.objectContaining({ jobId: "racana-render-job-123" })
    );
  });

  it("reuses a still-pending queue job instead of adding another", async () => {
    const remove = vi.fn();
    queueMocks.getJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue("waiting"),
      remove,
    });
    const queue = await import("../src/lib/queue/queue");

    const result = await queue.addJobToQueue("job-123", { task: "render" });

    expect(result.success).toBe(true);
    expect(queueMocks.add).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("replaces a failed queue job when retrying", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    queueMocks.getJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue("failed"),
      remove,
    });
    const queue = await import("../src/lib/queue/queue");

    const result = await queue.addJobToQueue("job-123", { task: "render" });

    expect(result.success).toBe(true);
    expect(remove).toHaveBeenCalledOnce();
    expect(queueMocks.add).toHaveBeenCalledOnce();
  });

  it("returns a failure for an unavailable dedicated queue", async () => {
    const queue = await import("../src/lib/queue/queue");
    const redisConnection = queue.redisConnection;
    if (!redisConnection) throw new Error("Expected mocked Redis connection");
    redisConnection.status = "end";

    const result = await queue.addJobToQueue("job-123", { task: "render" });

    expect(result.success).toBe(false);
    expect(queueMocks.add).not.toHaveBeenCalled();
  });

  it("deduplicates in-process dispatches for the same task", async () => {
    vi.stubEnv("RACANA_EMBEDDED_WORKER", "true");
    const queue = await import("../src/lib/queue/queue");
    const redisConnection = queue.redisConnection;
    if (!redisConnection) throw new Error("Expected mocked Redis connection");
    redisConnection.status = "end";

    const first = await queue.addJobToQueue("in-process-job", { task: "render" });
    const second = await queue.addJobToQueue("in-process-job", { task: "render" });
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(queueMocks.processBookJob).toHaveBeenCalledOnce();
  });
});
