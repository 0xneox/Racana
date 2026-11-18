import { describe, expect, it } from "vitest";
import {
  parseFormDataWithinLimit,
  readBodyWithinLimit,
  RequestBodyTooLargeError,
} from "../src/lib/http/body-limit";

describe("bounded request body parsing", () => {
  it("rejects an oversized declared body before reading it", async () => {
    const request = new Request("https://racana.test/upload", {
      method: "POST",
      headers: { "content-length": "11" },
      body: "x",
    });

    await expect(readBodyWithinLimit(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("enforces the limit when a streamed body exceeds its declared size", async () => {
    const request = new Request("https://racana.test/upload", {
      method: "POST",
      body: new Uint8Array(11),
    });

    await expect(readBodyWithinLimit(request, 10)).rejects.toBeInstanceOf(RequestBodyTooLargeError);
  });

  it("parses form data when the body is within the limit", async () => {
    const form = new FormData();
    form.set("fileName", "manuscript.docx");
    const request = new Request("https://racana.test/upload", { method: "POST", body: form });

    const parsed = await parseFormDataWithinLimit(request, 1024);
    expect(parsed.get("fileName")).toBe("manuscript.docx");
  });
});
