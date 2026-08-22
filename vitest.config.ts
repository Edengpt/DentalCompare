import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // One database, shared by every integration suite in here — and several of
    // them legitimately need to own its state for a moment: the homepage stats
    // are global aggregates, and the country guard has to be the last active
    // country to be the last active country. Run files in parallel and those
    // suites take table locks against each other and deadlock.
    //
    // The cost is a few seconds. The alternative is a suite that passes file by
    // file and fails, intermittently, only when run together.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Alias server-only to its empty shim so it doesn't throw in the test environment.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
});
