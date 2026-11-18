import { describe, expect, it } from "vitest";
import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { TEMPLATE_KEYS } from "../src/lib/templates/engine";

// Every deploy builds from git. A template that exists on disk but is
// ignored by git renders fine locally and fails every job in production.
const TEMPLATES_DIR = path.join("src", "lib", "renderer", "typst", "templates");

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

describe("typst templates ship with the repo", () => {
  const files = [...TEMPLATE_KEYS.map((k) => `${k}.typ`)];

  it("every template key has a .typ file on disk", () => {
    for (const f of files) expect(fs.existsSync(path.join(TEMPLATES_DIR, f)), f).toBe(true);
  });

  it.skipIf(git(["rev-parse", "--is-inside-work-tree"]) === null)("no template is git-ignored", () => {
    for (const f of files) {
      const rel = path.posix.join("src/lib/renderer/typst/templates", f);
      // `git check-ignore` prints the path (exit 0) only when it IS ignored.
      expect(git(["check-ignore", rel]), `${rel} is ignored by .gitignore`).toBeNull();
    }
  });
});
