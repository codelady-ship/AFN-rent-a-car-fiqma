import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 120_000,
    // one in-memory MongoDB per file; files run one after another to keep RAM low
    fileParallelism: false,
  },
});
