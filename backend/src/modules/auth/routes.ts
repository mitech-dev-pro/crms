import { loginSchema } from "@crms/shared";
import { Router } from "express";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "../../lib/session";
import { prisma } from "../../lib/db";
import { requireAuth } from "../../middleware/auth";
import { writeAudit } from "../../services/audit";
import { getSessionUser, login } from "./service";

export const authRouter = Router();

// POST /api/auth/login  { email, password }  → SessionUser + session cookie
authRouter.post("/login", async (req, res) => {
  // .parse throws a ZodError on bad input; the error handler turns it into a 400.
  const input = loginSchema.parse(req.body);
  const user = await login(input, req.ip);
  res.cookie(SESSION_COOKIE, await signSession(user.id), sessionCookieOptions);
  res.json(user);
});

// POST /api/auth/logout  → 204, cookie cleared. Works even if the session already expired.
authRouter.post("/logout", async (req, res) => {
  const userId = await verifySession(req.cookies?.[SESSION_COOKIE]);
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, role: true } });
    if (user) await writeAudit({ action: "Signed out", category: "signin", user, ip: req.ip });
  }
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions, maxAge: undefined });
  res.status(204).end();
});

// GET /api/auth/me  → the signed-in user, or 401. The frontend calls this on load.
authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(await getSessionUser(req.user!.id));
});
