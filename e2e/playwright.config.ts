import { defineConfig } from "@playwright/test";
import { API_PORT, WEB_PORT, backendDir, testDatabaseUrl } from "./test-env";

// End-to-end tests: a real browser (your installed Chrome) driving the real
// frontend and API, against the changehub_test database.
// Run with: npm run test:e2e   (from the repo root)
// Don't run this at the same time as the backend's `npm test`: both reset changehub_test.
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./global-setup.ts",
  fullyParallel: false, // tests share one database
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    channel: "chrome", // use the installed Google Chrome: no browser download needed
    trace: "retain-on-failure", // step-by-step recording of failed tests (npm run report -w @crms/e2e)
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      name: "API",
      command: "npx tsx src/index.ts",
      cwd: backendDir,
      url: `http://localhost:${API_PORT}/api/health`,
      env: {
        NODE_ENV: "test", // not "production": that would make the session cookie HTTPS-only
        PORT: String(API_PORT),
        DATABASE_URL: testDatabaseUrl(),
        CORS_ORIGIN: `http://localhost:${WEB_PORT}`,
        UPLOAD_DIR: ".e2e-uploads",
        LOGIN_MAX_PER_IP: "1000", // every test signs in; don't trip the per-address limit
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // A production build, so the tests exercise what would ship (and don't clash with `next dev`).
      name: "Web",
      command: `npx next build && npx next start -p ${WEB_PORT}`,
      cwd: "../frontend",
      url: `http://localhost:${WEB_PORT}/login`,
      env: { NODE_ENV: "production", API_URL: `http://localhost:${API_PORT}` }, // API_URL: where the /api rewrite points
      reuseExistingServer: false,
      timeout: 240_000,
    },
  ],
});
