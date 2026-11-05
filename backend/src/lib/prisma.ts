import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";

/**
 * Turns DATABASE_URL (mysql://user:pass@host:3306/db) into options for the
 * mariadb driver, which Prisma uses to talk to MySQL.
 */
export function adapterFromUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
  return new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1),
    connectionLimit: 5,
    // MySQL 8's default login method needs this on a local, non-TLS connection.
    allowPublicKeyRetrieval: true,
  });
}

/** Build a client. The app uses the shared `prisma` below; scripts like the seed build their own. */
export const createPrisma = (databaseUrl: string) => new PrismaClient({ adapter: adapterFromUrl(databaseUrl) });
