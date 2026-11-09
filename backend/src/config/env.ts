import "dotenv/config";
import { z } from "zod";

// Validate environment variables once at startup. A missing or malformed value
// stops the server immediately with a clear message, instead of failing later
// in some random request.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().startsWith("mysql://", "DATABASE_URL must look like mysql://user:pass@host:3306/db"),
  // Signs session tokens. Anyone holding it can forge a login, so keep it long, random and secret.
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  SESSION_HOURS: z.coerce.number().positive().default(8),
  // Login rate limits per 15 minutes (see middleware/rate-limit.ts).
  LOGIN_MAX_FAILURES: z.coerce.number().int().positive().default(10),
  LOGIN_MAX_PER_IP: z.coerce.number().int().positive().default(100),
  // Forgot / reset password requests per address per 15 minutes.
  RESET_MAX_PER_IP: z.coerce.number().int().positive().default(10),
  // Which proxies may tell us the client's IP (X-Forwarded-For): Express "trust proxy" syntax,
  // e.g. "loopback" (Next on the same machine) or "loopback, 10.0.0.5" (plus a reverse proxy).
  TRUST_PROXY: z.string().default("loopback"),
  // Folder for uploaded attachments (relative to backend/). Git-ignored.
  UPLOAD_DIR: z.string().default("uploads"),

  // ---- Email
  // Where links in emails point (the web app, not the API).
  APP_URL: z.url().optional(),
  // SMTP server. Leave SMTP_HOST empty and emails are written to MAIL_OUTBOX_DIR instead of
  // being sent: safe for development and tests, nothing leaves the machine.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"), // true for port 465
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("MiLife ChangeHub <changehub@milifeghana.com>"),
  MAIL_OUTBOX_DIR: z.string().default(".mail-outbox"),

  // ---- Reminders for late approvals (services/reminders.ts). Off in tests, which run it directly.
  REMINDERS_ENABLED: z.enum(["true", "false"]).optional().transform((v) => (v === undefined ? process.env.NODE_ENV !== "test" : v === "true")),
  REMINDER_INTERVAL_MINUTES: z.coerce.number().int().positive().default(30),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = { ...parsed.data, APP_URL: parsed.data.APP_URL ?? parsed.data.CORS_ORIGIN };
export const isProd = env.NODE_ENV === "production";
