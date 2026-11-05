import type { CookieOptions } from "express";
import { SignJWT, jwtVerify } from "jose";
import { env, isProd } from "../config/env";

// A session is a signed JWT stored in an httpOnly cookie:
//  - signed: the server can tell if anyone tampered with it (HS256 + JWT_SECRET)
//  - httpOnly: page JavaScript can't read it, so an XSS bug can't steal it
// The token only says WHO you are (sub = user id). Role and status are read
// fresh from the database on every request, so disabling a user or changing
// their role takes effect immediately.

export const SESSION_COOKIE = "crms_session";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const maxAgeMs = env.SESSION_HOURS * 60 * 60 * 1000;

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${env.SESSION_HOURS}h`)
    .sign(secret);
}

/** The user id inside a valid token, or null if it is missing, forged or expired. */
export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload.sub ?? null;
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
