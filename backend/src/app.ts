import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { approvalsRouter } from "./modules/approvals/routes";
import { auditRouter } from "./modules/audit/routes";
import { authRouter } from "./modules/auth/routes";
import { changesRouter } from "./modules/changes/routes";
import { healthRouter } from "./modules/health/routes";
import { metaRouter } from "./modules/meta/routes";
import { planningRouter } from "./modules/planning/routes";
import { reportsRouter } from "./modules/reports/routes";

/**
 * Builds the Express app without starting it, so tests can import it
 * and send requests without opening a port.
 */
export function createApp() {
  const app = express();

  // Requests arrive through the Next.js /api rewrite running on this machine.
  // Trust its X-Forwarded-For header (only from loopback) so req.ip — and the
  // audit trail — shows the real client address instead of 127.0.0.1.
  app.set("trust proxy", "loopback");

  // Middleware runs top to bottom for every request.
  app.use(helmet()); // security headers
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true })); // let the Next app call us and send cookies
  app.use(express.json({ limit: "1mb" })); // parse JSON bodies into req.body
  app.use(cookieParser()); // parse cookies into req.cookies (auth in Phase 3)

  // Feature routers. Each module owns its own paths under /api.
  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/meta", metaRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/changes", changesRouter);
  app.use("/api/approvals", approvalsRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api", planningRouter); // /api/calendar, /api/freezes, /api/workflows

  // These two must come last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
