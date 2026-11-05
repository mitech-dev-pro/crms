import { env } from "../config/env";
import { createPrisma } from "./prisma";

// One PrismaClient for the whole app. Each client holds a connection pool,
// so creating one per request would quickly exhaust MySQL connections.
export const prisma = createPrisma(env.DATABASE_URL);
