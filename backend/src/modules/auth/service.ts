import { PERMS, type LoginInput, type SessionUser } from "@crms/shared";
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/db";
import { AppError } from "../../lib/errors";
import { writeAudit } from "../../services/audit";

// Compared against when the email is unknown, so a wrong email takes as long as
// a wrong password. Otherwise response time would reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

// One message for every failure, for the same reason.
const invalidLogin = () => new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");

const sessionUserSelect = {
  id: true, code: true, name: true, email: true, title: true, role: true,
  department: { select: { id: true, name: true } },
} as const;

export async function login({ email, password }: LoginInput, ip?: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { ...sessionUserSelect, status: true, passwordHash: true },
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

  const { status: _s, passwordHash: _p, ...rest } = user;
  return toSessionUser(rest);
}

export async function getSessionUser(userId: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: sessionUserSelect });
  return toSessionUser(user);
}

function toSessionUser(u: Omit<SessionUser, "permissions">): SessionUser {
  return { ...u, permissions: [...PERMS[u.role]] };
}
