import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";

const s3Send = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class {
    send(...args: unknown[]) {
      return s3Send(...args);
    }
  },
  PutObjectCommand: class {
    constructor(public input: unknown) {}
  },
  GetObjectCommand: class {
    constructor(public input: unknown) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: unknown) {}
  },
  HeadBucketCommand: class {
    constructor(public input: unknown) {}
  },
}));

describe("production storage never uses instance-local fallback", () => {
  let fallbackDir: string;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    fallbackDir = path.join(os.tmpdir(), `racana-storage-${Date.now()}-${Math.random()}`);
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("S3_ENDPOINT", "https://s3.example.test");
    vi.stubEnv("S3_ACCESS_KEY", "access-key");
    vi.stubEnv("S3_SECRET_KEY", "secret-key");
    vi.stubEnv("STORAGE_FALLBACK_DIR", fallbackDir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    if (fs.existsSync(fallbackDir)) fs.rmSync(fallbackDir, { recursive: true, force: true });
  });

  it("fails upload rather than writing to local disk when S3 is unavailable", async () => {
    s3Send.mockRejectedValueOnce(new Error("S3 unavailable"));
    const storage = await import("../src/lib/storage/s3");

    await expect(storage.uploadToStorage("uploads/job/file.docx", Buffer.from("data"), "application/octet-stream")).rejects.toThrow("S3 unavailable");
    expect(fs.existsSync(fallbackDir)).toBe(false);
  });

  it("does not mask failed object deletion as successful", async () => {
    s3Send.mockRejectedValueOnce(new Error("S3 unavailable"));
    const storage = await import("../src/lib/storage/s3");

    await expect(storage.deleteFromStorage("uploads/job/file.docx")).rejects.toThrow("S3 unavailable");
    expect(fs.existsSync(fallbackDir)).toBe(false);
  });

  it("refuses storage operations when production credentials are missing", async () => {
    vi.stubEnv("S3_ENDPOINT", "");
    const storage = await import("../src/lib/storage/s3");

    await expect(storage.uploadToStorage("uploads/job/file.docx", Buffer.from("data"), "application/octet-stream")).rejects.toThrow(/instance-local storage/);
    expect(s3Send).not.toHaveBeenCalled();
  });

  it("probes both shared buckets for production readiness", async () => {
    s3Send.mockResolvedValue({});
    const storage = await import("../src/lib/storage/s3");

    await storage.checkStorageHealth();

    expect(s3Send).toHaveBeenCalledTimes(2);
  });
});
