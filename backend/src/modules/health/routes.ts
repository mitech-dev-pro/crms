import { Router } from "express";
import { prisma } from "../../lib/db";

export const healthRouter = Router();

// GET /api/health — liveness: the process is up. Cheap; never touches the database.
healthRouter.get("/", (_req, res) => {
  res.json({ ok: true, service: "crms-api", time: new Date().toISOString() });
});

// GET /api/health/ready — readiness: the API can actually serve requests (database reachable).
// Load balancers and monitors should use this one; 503 means "don't send traffic here".
healthRouter.get("/ready", async (_req, res) => {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, database: "up", latencyMs: Date.now() - started });
  } catch {
    res.status(503).json({ ok: false, database: "down" }); // no error details: this endpoint is public
  }
});
