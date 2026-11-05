import type { AuditCategory, Role } from "@crms/shared";
import type { PrismaClient } from "../generated/prisma/client";
import { prisma } from "../lib/db";

/** Works with the normal client or a transaction client (`tx`) inside prisma.$transaction. */
type Db = Pick<PrismaClient, "auditLog">;

export type AuditEntry = {
  action: string;
  category: AuditCategory;
  /** Who did it. Omit for anonymous events such as a failed sign-in. */
  user?: { id: string; name: string; role: Role };
  /** Shown when there is no user, e.g. the email someone tried to sign in with. */
  userName?: string;
  ref?: string;
  ip?: string;
  meta?: Record<string, unknown>;
};

/**
 * Appends one row to the audit trail.
 * Pass `tx` when the audited change happens in a transaction, so both are saved or neither is.
 */
export function writeAudit(entry: AuditEntry, db: Db = prisma) {
  return db.auditLog.create({
    data: {
      action: entry.action,
      category: entry.category,
      userId: entry.user?.id ?? null,
      userName: entry.user?.name ?? entry.userName ?? "unknown",
      role: entry.user?.role ?? null,
      ref: entry.ref ?? null,
      ip: entry.ip ?? null,
      meta: entry.meta as object | undefined,
    },
  });
}
