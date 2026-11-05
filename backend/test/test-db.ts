import "dotenv/config";

/**
 * Tests use a separate database: your DATABASE_URL with "_test" added to the
 * database name (changehub → changehub_test). Your dev data is never touched.
 */
export function testDatabaseUrl() {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set (see backend/.env.example)");
  const url = new URL(base);
  const name = url.pathname.slice(1);
  url.pathname = "/" + (name.endsWith("_test") ? name : `${name}_test`);
  return url.toString();
}
