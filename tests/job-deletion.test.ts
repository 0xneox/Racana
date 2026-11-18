import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  deleteJob: vi.fn(),
  deleteFromStorage: vi.fn(),
}));

vi.mock("../src/lib/db", () => ({
  default: {
    bookJob: {
      findUnique: mocks.findUnique,
      delete: mocks.deleteJob,
    },
  },
}));

vi.mock("../src/lib/storage/s3", () => ({
  deleteFromStorage: mocks.deleteFromStorage,
}));

import { deleteJobEverywhere } from "../src/lib/jobs/delete";

describe("job deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({
      id: "job-1",
      manuscriptAsset: { s3Key: "uploads/job-1/manuscript.docx", s3Bucket: "manuscripts" },
      artifacts: [{ s3Key: "artifacts/job-1/interior.pdf", s3Bucket: "artifacts" }],
    });
    mocks.deleteFromStorage.mockResolvedValue(undefined);
    mocks.deleteJob.mockResolvedValue(undefined);
  });

  it("keeps the database record when any stored object could not be deleted", async () => {
    mocks.deleteFromStorage.mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(deleteJobEverywhere("job-1")).rejects.toThrow("storage unavailable");
    expect(mocks.deleteJob).not.toHaveBeenCalled();
  });

  it("deletes the database record only after all stored objects are deleted", async () => {
    await deleteJobEverywhere("job-1");

    expect(mocks.deleteFromStorage).toHaveBeenCalledTimes(3);
    expect(mocks.deleteJob).toHaveBeenCalledOnce();
  });
});
