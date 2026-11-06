import { parse } from "dotenv";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The E2E run uses the backend's settings (backend/.env) but its own database,
// ports and upload folder, so it never touches your dev data or dev servers.
export const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../backend");

// Read backend/.env without loading it into process.env: its NODE_ENV=development
// would otherwise leak into `next build` (which must run as production).
const backendEnv = parse(readFileSync(path.join(backendDir, ".env")));

export const API_PORT = 4100;
export const WEB_PORT = 3100;

/** DATABASE_URL with "_test" appended to the database name (same one the API tests use). */
export function testDatabaseUrl() {
  const base = process.env.DATABASE_URL ?? backendEnv.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set in backend/.env");
  const url = new URL(base);
  const name = url.pathname.slice(1);
  url.pathname = "/" + (name.endsWith("_test") ? name : `${name}_test`);
  return url.toString();
}
