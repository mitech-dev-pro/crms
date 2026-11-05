import { can, type Screen } from "@crms/shared";
import type { RequestHandler } from "express";
import { prisma } from "../lib/db";
import { forbidden, unauthenticated } from "../lib/errors";
import { SESSION_COOKIE, sessionCookieOptions, verifySession } from "../lib/session";

/**
 * 401 unless the request carries a valid session cookie for an Active user.
 * On success, `req.user` is set for everything that runs after it.
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const userId = await verifySession(req.cookies?.[SESSION_COOKIE]);
  const user = userId
    ? await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, role: true, departmentId: true, status: true },
      })
    : null;

  if (!user || user.status !== "Active") {
    // A bad or stale cookie: remove it so the browser stops sending it.
    if (req.cookies?.[SESSION_COOKIE]) res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions, maxAge: undefined });
    throw unauthenticated();
  }

  const { status: _status, ...authUser } = user;
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
