import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../config/env";

const tooMany = (message: string) => ({ error: { code: "RATE_LIMITED", message } });

/**
 * Slows down password guessing.
 *  - per account + address: LOGIN_MAX_FAILURES failed attempts per 15 minutes
 *    (successful sign-ins don't count, so a typo or two never locks anyone out);
 *  - per address: a wider cap, against one machine trying many accounts.
 * Counters live in memory: fine for one server; use a shared store (e.g. Redis)
 * if the API ever runs on several machines.
 */
export const loginLimiters = [
  rateLimit({
    windowMs: 15 * 60_000,
    limit: env.LOGIN_MAX_FAILURES,
    skipSuccessfulRequests: true,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // ipKeyGenerator groups IPv6 addresses by subnet, so rotating within one network doesn't bypass it.
    keyGenerator: (req) => `${ipKeyGenerator(req.ip ?? "")}|${String(req.body?.email ?? "").trim().toLowerCase()}`,
    handler: (_req, res) => res.status(429).json(tooMany("Too many failed sign-in attempts. Try again in 15 minutes.")),
  }),
  rateLimit({
    windowMs: 15 * 60_000,
    limit: env.LOGIN_MAX_PER_IP,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
    handler: (_req, res) => res.status(429).json(tooMany("Too many sign-in attempts from this network. Try again later.")),
  }),
];
