import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteUser: vi.fn(),
  requireSession: vi.fn(),
  deleteJobEverywhere: vi.fn(),
  logServerError: vi.fn(),
  revokeSessionToken: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  default: {
    bookJob: { findMany: mocks.findMany },
    user: { delete: mocks.deleteUser },
  },
}));

vi.mock("@/lib/auth-utils", () => ({
  GENERIC_INTERNAL_ERROR: "Internal server error.",
  logServerError: mocks.logServerError,
  requireSession: mocks.requireSession,
}));

vi.mock("@/lib/jobs/delete", () => ({
  deleteJobEverywhere: mocks.deleteJobEverywhere,
}));

vi.mock("@/lib/auth/session-store", () => ({
  revokeSessionToken: mocks.revokeSessionToken,
}));

import { DELETE } from "../src/app/api/account/route";

describe("account deletion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([{ id: "job-1" }]);
    mocks.deleteUser.mockResolvedValue({});
    mocks.requireSession.mockResolvedValue({ user: { id: "user-1" }, error: null });
    mocks.deleteJobEverywhere.mockRejectedValue(new Error("storage unavailable"));
    mocks.revokeSessionToken.mockResolvedValue(undefined);
  });

  it("keeps the account active and returns an error if stored content remains", async () => {
    const response = await DELETE(new NextRequest("https://racana.test/api/account", { method: "DELETE" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("account remains active") });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});
