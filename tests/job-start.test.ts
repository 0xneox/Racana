import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  addJobToQueue: vi.fn(),
  requireIdentity: vi.fn(),
  requireJobOwner: vi.fn(),
  rateLimit: vi.fn(),
  logServerError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    bookJob: { findUnique: mocks.findUnique, updateMany: mocks.updateMany },
    renderArtifact: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/queue/queue", () => ({
  addJobToQueue: mocks.addJobToQueue,
}));

vi.mock("@/lib/auth-utils", () => ({
  GENERIC_INTERNAL_ERROR: "Internal server error.",
  logServerError: mocks.logServerError,
  requireIdentity: mocks.requireIdentity,
  requireJobOwner: mocks.requireJobOwner,
}));

vi.mock("@/lib/rate-limit", () => ({
  getClientIp: () => "127.0.0.1",
  rateLimit: mocks.rateLimit,
}));

import { POST } from "../src/app/api/jobs/[id]/start/route";

describe("job start queue failure recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      id: "job-1",
      status: "structure_ready",
      progress: 25,
      currentStep: "Structure detected",
      errorMessage: null,
      bookType: "novel",
      trimSize: "trim_6x9",
      payments: [],
    });
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.addJobToQueue.mockResolvedValue({
      success: false,
      queuedWith: "bullmq",
      error: "Queue unavailable",
    });
    mocks.requireIdentity.mockResolvedValue({ user: null, guestId: "guest-1" });
    mocks.requireJobOwner.mockResolvedValue({ error: null });
    mocks.rateLimit.mockResolvedValue({ allowed: true });
  });

  it("marks the job failed and retryable when queue dispatch fails", async () => {
    const request = new NextRequest("https://racana.test/api/jobs/job-1/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    const response = await POST(request, { params: { id: "job-1" } });

    expect(response.status).toBe(503);
    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
    expect(mocks.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: "job-1", status: "queued" },
        data: expect.objectContaining({
          status: "failed",
          currentStep: "Could not queue book generation",
        }),
      })
    );
  });
});
