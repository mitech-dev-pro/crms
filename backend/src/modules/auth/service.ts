import { PERMS, type ChangePasswordInput, type LoginInput, type SessionUser } from "@crms/shared";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env";
import { prisma } from "../../lib/db";
import { AppError } from "../../lib/errors";
import { sendMail } from "../../lib/mail";
import { writeAudit } from "../../services/audit";
import { emails } from "../../services/emails";

// Compared against when the email is unknown, so a wrong email takes as long as
// a wrong password. Otherwise response time would reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// One message for every failure, for the same reason.
const invalidLogin = () => new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");

const sessionUserSelect = {
  id: true, code: true, name: true, email: true, title: true, role: true, mustChangePassword: true,
  department: { select: { id: true, name: true } },
} as const;

/** Checks the password and returns the user plus the session version to sign into the cookie. */
export async function login({ email, password }: LoginInput, ip?: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...sessionUserSelect, status: true, passwordHash: true, sessionVersion: true },
  });

  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.passwordHash || !ok || user.status !== "Active") {
    const reason = !user ? "unknown email" : user.status !== "Active" ? `status ${user.status}` : "wrong password";
    await writeAudit({
      action: "Failed sign-in",
      category: "signin",
      user: user ? { id: user.id, name: user.name, role: user.role } : undefined,
      userName: email,
      ip,
      meta: { reason }, // the reason stays in the audit log; the caller only sees the generic message
    });
    throw invalidLogin();
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await writeAudit({ action: "Signed in", category: "signin", user, ip });

  const { status: _s, passwordHash: _p, sessionVersion, ...rest } = user;
  return { user: toSessionUser(rest), version: sessionVersion };
}

/** Ends every session of this user (all devices), e.g. on logout. */
export async function revokeSessions(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
}

/**
 * Self-service password change (also the forced change after a temporary password).
 * Ends all other sessions; returns the new session version for the caller's fresh cookie.
 */
export async function changePassword(u: { id: string; name: string; role: SessionUser["role"]; ip?: string }, input: ChangePasswordInput) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { passwordHash: true } });
  if (!user.passwordHash || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new AppError(400, "VALIDATION_ERROR", "Your current password is incorrect");
  }
  if (await bcrypt.compare(input.newPassword, user.passwordHash)) {
    throw new AppError(400, "VALIDATION_ERROR", "Choose a password you haven't just used");
  }
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.user.update({
      where: { id: u.id },
      data: { passwordHash: await bcrypt.hash(input.newPassword, 10), mustChangePassword: false, sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });
    await writeAudit({ action: "Changed own password", category: "signin", user: u, ip: u.ip }, tx);
    return row;
  });
  const me = await prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { email: true, name: true } });
  sendMail(emails.passwordChanged([me.email], me.name)); // so the owner notices if it wasn't them
  return updated.sessionVersion;
}

// ------------------------------------------------------------------ forgotten password

/** How long an emailed reset link works. */
export const RESET_LINK_MINUTES = 60;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * "Forgot password": emails a one-time link to an Active user. Callers always get the same
 * answer and run this in the background, so the response never reveals whether an email exists.
 * Only the token's hash is stored; earlier unused links stop working.
 */
export async function requestPasswordReset(email: string, ip?: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, role: true, status: true } });
  if (!user || user.status !== "Active") {
    await writeAudit({ action: "Password reset requested (no email sent)", category: "signin", userName: email, ip, meta: { reason: user ? `status ${user.status}` : "unknown email" } });
    return;
  }
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_LINK_MINUTES * 60_000) } });
    await writeAudit({ action: "Password reset link emailed", category: "signin", user, ip }, tx);
  });
  sendMail(emails.passwordReset([user.email], user.name, `${env.APP_URL}/reset-password?token=${token}`, RESET_LINK_MINUTES));
}

const badLink = () => new AppError(400, "INVALID_RESET_LINK", "This reset link has expired or has already been used. Request a new one.");

/** Sets a new password from an emailed link. The link works once; every session is signed out. */
export async function resetPassword(token: string, newPassword: string, ip?: string) {
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, status: true } } },
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || row.user.status !== "Active") throw badLink();

  await prisma.$transaction(async (tx) => {
    // Claim the link first: only one of two simultaneous uses can succeed.
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw badLink();
    await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash: await bcrypt.hash(newPassword, 10), mustChangePassword: false, sessionVersion: { increment: 1 } },
    });
    await writeAudit({ action: "Reset password with emailed link", category: "signin", user: row.user, ip }, tx);
  });
  sendMail(emails.passwordChanged([row.user.email], row.user.name));
}

export async function getSessionUser(userId: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: sessionUserSelect });
  return toSessionUser(user);
}

function toSessionUser(u: Omit<SessionUser, "permissions">): SessionUser {
  return { ...u, permissions: [...PERMS[u.role]] };
}
