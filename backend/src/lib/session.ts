import type { CookieOptions } from "express";
import { SignJWT, jwtVerify } from "jose";
import { env, isProd } from "../config/env";

// A session is a signed JWT stored in an httpOnly cookie:
//  - signed: the server can tell if anyone tampered with it (HS256 + JWT_SECRET)
//  - httpOnly: page JavaScript can't read it, so an XSS bug can't steal it
// The token says WHO you are (sub = user id) and which session version it was
// issued for (v). Role and status are read fresh from the database on every
// request, and the token is refused once the user's sessionVersion has moved on
// (logout, password change, disable, role change), so a copied token dies too.

export const SESSION_COOKIE = "crms_session";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const maxAgeMs = env.SESSION_HOURS * 60 * 60 * 1000;

export async function signSession(userId: string, version: number): Promise<string> {
  return new SignJWT({ v: version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${env.SESSION_HOURS}h`)
    .sign(secret);
}

/** The user id and session version inside a valid token, or null if missing, forged or expired. */
export async function verifySession(token: string | undefined): Promise<{ userId: string; version: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload.sub ? { userId: payload.sub, version: typeof payload.v === "number" ? payload.v : -1 } : null;
  } catch {
    return null;
  }
}

export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd, // HTTPS-only in production; plain http://localhost in dev
  sameSite: "lax", // sent on same-site requests (localhost:3000 → localhost:4000 counts as same-site)
  path: "/",
  maxAge: maxAgeMs,
};
