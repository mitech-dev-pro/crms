// Sending email. Two modes, chosen by SMTP_HOST:
// - SMTP_HOST set: real delivery through that SMTP server.
// - SMTP_HOST empty (development, tests): each message is written as an .eml file to
//   MAIL_OUTBOX_DIR. Double-click one to open it in Outlook or Mail. Nothing leaves the machine.
//
// Sending never blocks or fails a request: messages are queued and errors are logged.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { env } from "../config/env";

export type Mail = { to: string[]; subject: string; text: string; html: string };

const outboxMode = !env.SMTP_HOST;
const transport = outboxMode
  ? nodemailer.createTransport({ streamTransport: true, buffer: true, newline: "unix" })
  : nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      ...(env.SMTP_USER && { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } }),
    });

const outboxDir = path.resolve(process.cwd(), env.MAIL_OUTBOX_DIR);

/** The last messages handed to the mailer (newest last). Lets tests check what was sent. */
export const recentMail: Mail[] = [];

async function deliver(mail: Mail) {
  const to = [...new Set(mail.to.filter(Boolean))];
  if (!to.length) return;
  const info = await transport.sendMail({ from: env.MAIL_FROM, to, subject: mail.subject, text: mail.text, html: mail.html });
  if (outboxMode) {
    await mkdir(outboxDir, { recursive: true });
    const slug = mail.subject.replace(/[^a-z0-9]+/gi, "-").slice(0, 60).replace(/^-|-$/g, "");
    const file = path.join(outboxDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${slug}.eml`);
    await writeFile(file, info.message as Buffer);
    if (env.NODE_ENV === "development") console.log(`[mail] ${to.join(", ")} · ${mail.subject} → ${path.relative(process.cwd(), file)}`);
  }
}

const pending = new Set<Promise<void>>();

/** Queues an email. Returns immediately; a failure is logged, never thrown at the caller. */
export function sendMail(mail: Mail) {
  recentMail.push(mail);
  if (recentMail.length > 200) recentMail.shift();
  const p = deliver(mail)
    .catch((e) => console.error(`[mail] could not send "${mail.subject}":`, e instanceof Error ? e.message : e))
    .finally(() => pending.delete(p));
  pending.add(p);
}

/**
 * Runs work that ends in emails (looking up recipients, then sendMail) without making the
 * request wait. Errors are logged. flushMail() waits for it too.
 */
export function inBackground(work: Promise<unknown>, what: string) {
  const p = work
    .then(() => undefined)
    .catch((e) => console.error(`[mail] ${what} failed:`, e instanceof Error ? e.message : e))
    .finally(() => pending.delete(p));
  pending.add(p);
}

/** Waits for queued emails and background work to finish (tests, and graceful shutdown). */
export async function flushMail() {
  while (pending.size) await Promise.all([...pending]);
}
