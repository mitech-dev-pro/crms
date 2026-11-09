import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { backendDir, testDatabaseUrl } from "./test-env";

// Before the tests: bring changehub_test up to date and load the demo data,
// so every run starts from the same state.
export default function globalSetup() {
  const url = testDatabaseUrl();
  if (!new URL(url).pathname.endsWith("_test")) throw new Error("Refusing to reset a non-test database");
  const env = { ...process.env, DATABASE_URL: url };
  execSync("npx prisma migrate deploy", { cwd: backendDir, env, stdio: "inherit" });
  execSync("npx tsx prisma/seed.ts", { cwd: backendDir, env, stdio: "inherit" });
  rmSync(path.join(backendDir, ".e2e-uploads"), { recursive: true, force: true });
  rmSync(path.join(backendDir, ".e2e-mail"), { recursive: true, force: true }); // emails from the previous run
}
