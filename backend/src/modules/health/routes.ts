import { Router } from "express";

export const healthRouter = Router();

// Used by you, monitoring and later the frontend to check that the API is up.
healthRouter.get("/", (_req, res) => {
  res.json({ ok: true, service: "crms-api", time: new Date().toISOString() });
});
