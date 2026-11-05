import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { healthRouter } from "./modules/health/routes";

/**
 * Builds the Express app without starting it, so tests can import it
 * and send requests without opening a port.
 */
export function createApp() {
  const app = express();

  // Middleware runs top to bottom for every request.
  app.use(helmet()); // security headers
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true })); // let the Next app call us and send cookies
  app.use(express.json({ limit: "1mb" })); // parse JSON bodies into req.body
  app.use(cookieParser()); // parse cookies into req.cookies (auth in Phase 3)

  // Feature routers. Each module owns its own paths under /api.
  app.use("/api/health", healthRouter);

  // These two must come last.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
