// Stand-ins (delegations): while an approver is away, someone they name can decide
// approval stages for the approver's role on their behalf.
import { isApproverRole, type Role, type StandInDto } from "@crms/shared";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/db";
import { isoDate } from "./routing";

type Db = Pick<typeof prisma, "delegation">;

/** Today as a UTC calendar day, to compare with the @db.Date columns. */
export const today = (now = new Date()) => new Date(`${isoDate(now)}T00:00:00Z`);

/** In force today: started, not past its end, not revoked, and the absent approver is still Active. */
export const activeWhere = (now = new Date()): Prisma.DelegationWhereInput => ({
  revokedAt: null,
  startsOn: { lte: today(now) },
  endsOn: { gte: today(now) },
  fromUser: { status: "Active" },
});

/** Who this user is covering for today, with the role they're covering. */
export async function standInsFor(userId: string, db: Db = prisma, now = new Date()) {
  const rows = await db.delegation.findMany({
    where: { toUserId: userId, ...activeWhere(now) },
    select: { fromUser: { select: { id: true, name: true, role: true } } },
  });
  return rows.map((r) => ({ userId: r.fromUser.id, name: r.fromUser.name, role: r.fromUser.role })).filter((s) => isApproverRole(s.role));
}

/** Emails of everyone currently standing in for any of these users. */
export async function standInEmailsFor(userIds: string[], now = new Date()) {
  if (!userIds.length) return [];
  const rows = await prisma.delegation.findMany({
    where: { fromUserId: { in: userIds }, ...activeWhere(now), toUser: { status: "Active" } },
    select: { toUser: { select: { email: true } } },
  });
  return rows.map((r) => r.toUser.email);
}

export const standInInclude = {
  fromUser: { select: { id: true, name: true, role: true } },
  toUser: { select: { id: true, name: true, role: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.DelegationInclude;

type Row = Prisma.DelegationGetPayload<{ include: typeof standInInclude }>;

export function toStandIn(d: Row, now = new Date()): StandInDto {
  const t = today(now).getTime();
  const state = d.revokedAt || d.endsOn.getTime() < t ? "ended" : d.startsOn.getTime() > t ? "upcoming" : "active";
  return {
    id: d.id,
    from: { id: d.fromUser.id, name: d.fromUser.name, role: d.fromUser.role as Role },
    to: { id: d.toUser.id, name: d.toUser.name, role: d.toUser.role as Role },
    startsOn: isoDate(d.startsOn),
    endsOn: isoDate(d.endsOn),
    reason: d.reason,
    createdBy: d.createdBy,
    state,
  };
}
