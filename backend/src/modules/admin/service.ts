import {
  PRIVILEGED_ROLES, ROLES, ROLE_LABELS, canAssignRole, userInviteSchema,
  type AdminChangeType, type AdminDepartment, type AdminUser, type AdminUserListResponse,
  type ChangeTypeCreateInput, type ChangeTypeUpdateInput, type DepartmentCreateInput, type DepartmentUpdateInput,
  type Role, type UserImportResult, type UserInviteInput, type UserListQuery, type UserUpdateInput, type WorkflowUpdateInput,
} from "@crms/shared";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { AppError, forbidden, notFound } from "../../lib/errors";
import { writeAudit } from "../../services/audit";

type Tx = Prisma.TransactionClient;
export type Actor = { id: string; name: string; role: Role; ip?: string };

const audit = (tx: Tx, u: Actor, action: string, ref?: string, meta?: Record<string, unknown>) =>
  writeAudit({ action, category: "config", user: u, ref, ip: u.ip, meta }, tx);

/** Turns a unique-index clash into a clear 409 instead of a 500. */
async function unique<T>(what: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new AppError(409, "DUPLICATE", `A ${what} with that value already exists`);
    throw e;
  }
}

async function activeUser(tx: Tx, id: string | null | undefined, field: string) {
  if (!id) return;
  if (!(await tx.user.findFirst({ where: { id, status: "Active" } }))) throw new AppError(400, "INVALID_REFERENCE", `${field}: unknown or inactive user`);
}

// ------------------------------------------------------------------ departments

export async function listDepartments(): Promise<AdminDepartment[]> {
  const rows = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: {
      head: { select: { id: true, name: true } },
      lineManager: { select: { id: true, name: true } },
      _count: { select: { users: true, workflows: true } },
    },
  });
  return rows.map((d) => ({
    id: d.id, code: d.code, name: d.name, active: d.active, head: d.head, lineManager: d.lineManager,
    userCount: d._count.users, hasCustomRoute: d._count.workflows > 0,
  }));
}

export async function createDepartment(u: Actor, d: DepartmentCreateInput) {
  await unique("department", () =>
    prisma.$transaction(async (tx) => {
      await activeUser(tx, d.headId, "headId");
      await activeUser(tx, d.lineManagerId, "lineManagerId");
      await tx.department.create({ data: { code: d.code, name: d.name, headId: d.headId ?? null, lineManagerId: d.lineManagerId ?? null } });
      await audit(tx, u, `Added department ${d.name} (${d.code})`, d.code);
    }),
  );
}

export async function updateDepartment(u: Actor, id: string, d: DepartmentUpdateInput) {
  await unique("department", () =>
    prisma.$transaction(async (tx) => {
      const dept = await tx.department.findUnique({ where: { id } });
      if (!dept) throw notFound("Department");
      await activeUser(tx, d.headId, "headId");
      await activeUser(tx, d.lineManagerId, "lineManagerId");
      await tx.department.update({ where: { id }, data: d });
      const what = d.active === false ? "Deactivated" : d.active === true && !dept.active ? "Reactivated" : "Updated";
      await audit(tx, u, `${what} department ${d.name ?? dept.name}`, d.code ?? dept.code, { fields: Object.keys(d) });
    }),
  );
}

// ------------------------------------------------------------------ change types

export async function listChangeTypes(): Promise<AdminChangeType[]> {
  const rows = await prisma.changeType.findMany({ orderBy: { label: "asc" }, include: { _count: { select: { changes: true } } } });
  return rows.map((t) => ({ id: t.id, label: t.label, description: t.description, active: t.active, changeCount: t._count.changes }));
}

export async function createChangeType(u: Actor, d: ChangeTypeCreateInput) {
  await unique("change type", () =>
    prisma.$transaction(async (tx) => {
      await tx.changeType.create({ data: d });
      await audit(tx, u, `Added change type ${d.label}`);
    }),
  );
}

export async function updateChangeType(u: Actor, id: string, d: ChangeTypeUpdateInput) {
  await unique("change type", () =>
    prisma.$transaction(async (tx) => {
      const t = await tx.changeType.findUnique({ where: { id } });
      if (!t) throw notFound("Change type");
      await tx.changeType.update({ where: { id }, data: d });
      const what = d.active === false ? "Deactivated" : d.active === true && !t.active ? "Reactivated" : "Updated";
      await audit(tx, u, `${what} change type ${d.label ?? t.label}`, undefined, { fields: Object.keys(d) });
    }),
  );
}

// ------------------------------------------------------------------ users

const userSelect = {
  id: true, code: true, name: true, email: true, title: true, role: true, status: true, lastLoginAt: true,
  department: { select: { id: true, name: true } },
} as const;

const toAdminUser = (u: Prisma.UserGetPayload<{ select: typeof userSelect }>): AdminUser => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null });

function userWhere(q: Omit<UserListQuery, "page" | "pageSize" | "status">): Prisma.UserWhereInput {
  return {
    ...(q.role && { role: q.role }),
    ...(q.departmentId && { departmentId: q.departmentId }),
    ...(q.q && { OR: [{ name: { contains: q.q } }, { email: { contains: q.q } }, { code: { contains: q.q } }] }),
  };
}

export async function listUsers(q: UserListQuery): Promise<AdminUserListResponse> {
  const base = userWhere(q);
  const where = q.status ? { ...base, status: q.status } : base;
  const [rows, total, byStatus] = await Promise.all([
    prisma.user.findMany({ where, orderBy: { name: "asc" }, skip: (q.page - 1) * q.pageSize, take: q.pageSize, select: userSelect }),
    prisma.user.count({ where }),
    prisma.user.groupBy({ by: ["status"], where: base, _count: { _all: true } }), // chip counts ignore the status filter
  ]);
  const counts = { Active: 0, Invited: 0, Disabled: 0 };
  for (const g of byStatus) counts[g.status] = g._count._all;
  return { items: rows.map(toAdminUser), total, page: q.page, pageSize: q.pageSize, counts };
}

export async function exportUsers(u: Actor, q: Omit<UserListQuery, "page" | "pageSize">) {
  const base = userWhere(q);
  const rows = await prisma.user.findMany({ where: q.status ? { ...base, status: q.status } : base, orderBy: { name: "asc" }, select: userSelect });
  await writeAudit({ action: "Exported users (CSV)", category: "export", user: u, ip: u.ip, meta: { rows: rows.length } });
  return [
    ["Code", "Name", "Email", "Role", "Department", "Status", "Last sign-in (UTC)"],
    ...rows.map((r) => [r.code, r.name, r.email, ROLE_LABELS[r.role], r.department.name, r.status, r.lastLoginAt?.toISOString() ?? ""]),
  ];
}

async function nextUserCode(tx: Tx) {
  const last = await tx.user.findFirst({ where: { code: { startsWith: "USR-" } }, orderBy: { code: "desc" }, select: { code: true } });
  return `USR-${String((last ? Number(last.code.slice(4)) : 200) + 1).padStart(4, "0")}`;
}

function assertCanAssign(u: Actor, from: Role, to: Role) {
  if (!canAssignRole(u.role, from, to)) throw forbidden("Only a super admin can grant or remove the admin roles");
}

async function createInvited(tx: Tx, u: Actor, d: UserInviteInput) {
  const code = await nextUserCode(tx);
  const created = await tx.user.create({ data: { code, name: d.name, email: d.email, role: d.role, departmentId: d.departmentId, status: "Invited" } });
  return created;
}

export async function inviteUser(u: Actor, d: UserInviteInput) {
  assertCanAssign(u, "requester", d.role);
  return unique("user", () =>
    prisma.$transaction(async (tx) => {
      if (!(await tx.department.findFirst({ where: { id: d.departmentId, active: true } }))) throw new AppError(400, "INVALID_REFERENCE", "departmentId: unknown or inactive department");
      const created = await createInvited(tx, u, d);
      await audit(tx, u, `Invited ${d.name} as ${ROLE_LABELS[d.role]}`, created.code);
      return toAdminUser((await tx.user.findUniqueOrThrow({ where: { id: created.id }, select: userSelect })));
    }),
  );
}

export async function updateUser(u: Actor, id: string, d: UserUpdateInput) {
  // Changing your own role or disabling yourself is how admins lock themselves out
  // (or quietly escalate). Another admin has to do it.
  if (id === u.id) throw forbidden("You can't change your own role, department or status");

  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id }, include: { department: true } });
    if (!target) throw notFound("User");
    // Even disabling or moving an admin is reserved for a super admin.
    if (PRIVILEGED_ROLES.includes(target.role) && u.role !== "superAdmin") throw forbidden("Only a super admin can change an admin account");
    if (d.role) assertCanAssign(u, target.role, d.role);
    if (d.status && target.status === "Invited") throw new AppError(409, "INVALID_STATE", "An invited user becomes active when their password is set (Reset password)");

    let dept = target.department;
    if (d.departmentId && d.departmentId !== target.departmentId) {
      const next = await tx.department.findFirst({ where: { id: d.departmentId, active: true } });
      if (!next) throw new AppError(400, "INVALID_REFERENCE", "departmentId: unknown or inactive department");
      dept = next;
    }
    // Disabling or changing role ends their current sessions, so the change bites immediately.
    const revoke = (d.status && d.status !== target.status) || (d.role && d.role !== target.role);
    await tx.user.update({ where: { id }, data: { ...d, ...(revoke && { sessionVersion: { increment: 1 } }) } });

    if (d.role && d.role !== target.role) await audit(tx, u, `Changed role of ${target.name}: ${ROLE_LABELS[target.role]} → ${ROLE_LABELS[d.role]}`, target.code);
    if (d.departmentId && d.departmentId !== target.departmentId) await audit(tx, u, `Moved ${target.name} to ${dept.name}`, target.code);
    if (d.status && d.status !== target.status) await audit(tx, u, `${d.status === "Disabled" ? "Disabled" : "Enabled"} ${target.name}`, target.code);
    return toAdminUser(await tx.user.findUniqueOrThrow({ where: { id }, select: userSelect }));
  });
}

/**
 * Sets a one-time temporary password and returns it once, for the admin to pass on.
 * Only the bcrypt hash is stored; the password itself is never logged.
 * An invited user becomes Active. The user must choose a new password at first sign-in,
 * and any existing sessions of theirs end.
 */
export async function resetPassword(u: Actor, id: string) {
  if (id === u.id) throw forbidden("Use your own account settings to change your password");
  return prisma.$transaction(async (tx) => {
    const target = await tx.user.findUnique({ where: { id } });
    if (!target) throw notFound("User");
    if (PRIVILEGED_ROLES.includes(target.role) && u.role !== "superAdmin") throw forbidden("Only a super admin can reset an admin's password");
    if (target.status === "Disabled") throw new AppError(409, "INVALID_STATE", "Enable the user before resetting their password");

    const temporaryPassword = randomBytes(9).toString("base64url"); // 12 random characters
    await tx.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(temporaryPassword, 10), status: "Active", mustChangePassword: true, sessionVersion: { increment: 1 } } });
    await audit(tx, u, target.status === "Invited" ? `Activated ${target.name} with a temporary password` : `Reset password for ${target.name}`, target.code);
    return { temporaryPassword };
  });
}

/** Validates every row (department/role by name, code or label), then creates the valid ones unless dryRun. */
export async function importUsers(u: Actor, rows: { name: string; email: string; department: string; role: string }[], dryRun: boolean): Promise<UserImportResult> {
  const [depts, existing] = await Promise.all([
    prisma.department.findMany({ where: { active: true }, select: { id: true, name: true, code: true } }),
    prisma.user.findMany({ where: { email: { in: rows.map((r) => r.email.trim().toLowerCase()) } }, select: { email: true } }),
  ]);
  const deptBy = new Map(depts.flatMap((d) => [[d.name.toLowerCase(), d.id], [d.code.toLowerCase(), d.id]]));
  const roleBy = new Map<string, Role>(ROLES.flatMap((r) => [[r.toLowerCase(), r], [ROLE_LABELS[r].toLowerCase(), r]] as [string, Role][]));
  const taken = new Set(existing.map((e) => e.email));
  const seen = new Set<string>();

  const checked = rows.map((raw, i) => {
    const errors: string[] = [];
    const role = roleBy.get(raw.role.trim().toLowerCase());
    const departmentId = deptBy.get(raw.department.trim().toLowerCase());
    if (!departmentId) errors.push(`Unknown department "${raw.department}"`);
    if (!role) errors.push(`Unknown role "${raw.role}"`);
    else if (!canAssignRole(u.role, "requester", role)) errors.push("Only a super admin can create admin accounts");
    const parsed = role && departmentId ? userInviteSchema.safeParse({ name: raw.name, email: raw.email, departmentId, role }) : null;
    if (parsed && !parsed.success) errors.push(...parsed.error.issues.map((x) => x.message));
    const email = raw.email.trim().toLowerCase();
    if (taken.has(email)) errors.push("A user with this email already exists");
    else if (seen.has(email)) errors.push("Duplicate email in this file");
    seen.add(email);
    return { row: i + 2, email, ok: errors.length === 0, errors, input: parsed?.success ? parsed.data : null }; // row 1 is the header
  });

  const valid = checked.filter((c) => c.ok && c.input);
  if (!dryRun && valid.length) {
    await prisma.$transaction(async (tx) => {
      for (const c of valid) await createInvited(tx, u, c.input!);
      await audit(tx, u, `Imported ${valid.length} users (CSV)`, undefined, { skipped: checked.length - valid.length });
    });
  }
  return { dryRun, created: dryRun ? 0 : valid.length, results: checked.map(({ input: _i, ...r }) => r) };
}

// ------------------------------------------------------------------ workflows

/** Replaces one tier's route. Empty roles for a department removes its override (back to the default). */
export async function updateWorkflow(u: Actor, w: WorkflowUpdateInput) {
  await prisma.$transaction(async (tx) => {
    const dept = w.departmentId ? await tx.department.findUnique({ where: { id: w.departmentId } }) : null;
    if (w.departmentId && !dept) throw notFound("Department");
    await tx.workflowStage.deleteMany({ where: { departmentId: w.departmentId, tier: w.tier } });
    await tx.workflowStage.createMany({ data: w.roles.map((role, order) => ({ departmentId: w.departmentId, tier: w.tier, order, role })) });

    const scope = dept?.name ?? "All departments (default)";
    const action = w.roles.length
      ? `Updated workflow: ${scope} · ${w.tier}: ${w.roles.map((r) => ROLE_LABELS[r]).join(" → ")}`
      : `Reset workflow to default: ${scope} · ${w.tier}`;
    await audit(tx, u, action, `WF-${dept?.code ?? "DEFAULT"}-${w.tier.toUpperCase()}`);
  });
}
