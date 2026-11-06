import { can, type Screen } from "@crms/shared";
import type { RequestHandler } from "express";
import { prisma } from "../lib/db";
import { AppError, forbidden, unauthenticated } from "../lib/errors";
import { SESSION_COOKIE, sessionCookieOptions, verifySession } from "../lib/session";

// While a temporary password is in use, only these calls are allowed: the user
// can see who they are and choose a new password, nothing else.
const ALLOWED_DURING_PASSWORD_CHANGE = new Set(["/api/auth/me", "/api/auth/change-password"]);

/**
 * 401 unless the request carries a valid session cookie, issued for the user's
 * current session version, for an Active user. On success `req.user` is set.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const session = await verifySession(req.cookies?.[SESSION_COOKIE]);
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, name: true, email: true, role: true, departmentId: true, status: true, sessionVersion: true, mustChangePassword: true },
      })
    : null;

  if (!user || user.status !== "Active" || user.sessionVersion !== session!.version) {
    // A bad, stale or revoked cookie: remove it so the browser stops sending it.
    if (req.cookies?.[SESSION_COOKIE]) res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions, maxAge: undefined });
    throw unauthenticated();
  }

  if (user.mustChangePassword && !ALLOWED_DURING_PASSWORD_CHANGE.has(req.originalUrl.split("?")[0]!)) {
    throw new AppError(403, "PASSWORD_CHANGE_REQUIRED", "Choose a new password to continue");
  }

  const { status: _s, sessionVersion: _v, mustChangePassword: _m, ...authUser } = user;
  req.user = authUser;
  next();
};

/**
 * 403 unless the signed-in user's role may open this screen (shared PERMS table).
 * Always put it after requireAuth:  router.get("/", requireAuth, requirePerm("audit"), handler)
 */
export const requirePerm =
  (screen: Screen): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) throw unauthenticated();
    if (!can(req.user.role, screen)) throw forbidden(`Your role cannot access "${screen}"`);
    next();
  };
