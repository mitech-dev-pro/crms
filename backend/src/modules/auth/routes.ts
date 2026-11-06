import { changePasswordSchema, loginSchema } from "@crms/shared";
import { Router, type Response } from "express";
import { prisma } from "../../lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "../../lib/session";
import { requireAuth } from "../../middleware/auth";
import { loginLimiters } from "../../middleware/rate-limit";
import { writeAudit } from "../../services/audit";
import { changePassword, getSessionUser, login, revokeSessions } from "./service";

export const authRouter = Router();

const setSessionCookie = async (res: Response, userId: string, version: number) =>
  res.cookie(SESSION_COOKIE, await signSession(userId, version), sessionCookieOptions);

// POST /api/auth/login  { email, password }  → SessionUser + session cookie (rate-limited)
authRouter.post("/login", ...loginLimiters, async (req, res) => {
  // .parse throws a ZodError on bad input; the error handler turns it into a 400.
  const input = loginSchema.parse(req.body);
  const { user, version } = await login(input, req.ip);
  await setSessionCookie(res, user.id, version);
  res.json(user);
});

// POST /api/auth/logout → 204. Ends the session everywhere: the token can't be reused even if copied.
authRouter.post("/logout", async (req, res) => {
  const session = await verifySession(req.cookies?.[SESSION_COOKIE]);
  if (session) {
    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, role: true, sessionVersion: true } });
    // Only a still-valid session may revoke (an old copied token can't sign others out).
    if (user && user.sessionVersion === session.version) {
      await revokeSessions(user.id);
      await writeAudit({ action: "Signed out", category: "signin", user, ip: req.ip });
    }
  }
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions, maxAge: undefined });
  res.status(204).end();
});

// GET /api/auth/me  → the signed-in user, or 401. The frontend calls this on load.
authRouter.get("/me", requireAuth, async (req, res) => {
  res.json(await getSessionUser(req.user!.id));
});

// POST /api/auth/change-password { currentPassword, newPassword } → SessionUser with a fresh cookie.
// Signs out every other session of this user.
authRouter.post("/change-password", requireAuth, async (req, res) => {
  const version = await changePassword({ ...req.user!, ip: req.ip }, changePasswordSchema.parse(req.body));
  await setSessionCookie(res, req.user!.id, version);
  res.json(await getSessionUser(req.user!.id));
});
