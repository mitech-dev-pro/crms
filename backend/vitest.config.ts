import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./test/test-db";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: "./test/global-setup.ts",
    // Every test file and the app under test talk to the test database.
    env: { DATABASE_URL: testDatabaseUrl(), NODE_ENV: "test" },
    // Files share one database, so run them one at a time.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 120_000,
  },
});
