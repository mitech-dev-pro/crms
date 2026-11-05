import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { testDatabaseUrl } from "./test-db";

// Runs once before all test files: bring the test database's tables up to date
// with the migrations, then load the demo data so every run starts the same.
export function setup() {
  const url = testDatabaseUrl();
  if (!new URL(url).pathname.endsWith("_test")) throw new Error("Refusing to reset a non-test database");

  const env = { ...process.env, DATABASE_URL: url };
  console.log(`\n[test] preparing ${new URL(url).pathname.slice(1)}…`);
  execSync("npx prisma migrate deploy", { env, stdio: "inherit" }); // creates the database if it is missing
  execSync("npx tsx prisma/seed.ts", { env, stdio: "inherit" });
  rmSync(".test-uploads", { recursive: true, force: true }); // uploaded files from the previous run
}
