import { defineConfig } from "vitest/config";
import path from "path";

// Heavy native-ish work (Typst child processes, pdfjs workers) is flaky under
// vitest's thread pool on Windows — a segfault in a fork doesn't take the
// runner's exit code down, and a single fork avoids parallel resource spikes.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
