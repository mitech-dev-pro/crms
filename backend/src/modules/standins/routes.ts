// Stand-ins for approvers on leave.
//  - Approvers arrange cover for themselves (My approvals page).
//  - Admins, super admins and Change Managers can arrange or end cover for anyone (Administration).
import { ROLE_LABELS, can, isApproverRole, standInSchema, type Role } from "@crms/shared";
import { Router, type Request } from "express";
import { prisma } from "../../lib/db";
import { AppError, forbidden, notFound } from "../../lib/errors";
import { sendMail } from "../../lib/mail";
import { requireAuth } from "../../middleware/auth";
import { writeAudit } from "../../services/audit";
import { emails } from "../../services/emails";
import { standInInclude, toStandIn, today } from "../../services/standins";

export const standInsRouter = Router();
standInsRouter.use(requireAuth);

const MANAGERS: Role[] = ["admin", "superAdmin", "changeManager"];
const MAX_DAYS = 90;
const isManager = (req: Request) => MANAGERS.includes(req.user!.role);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`);
const label = (iso: string) => day(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// GET /api/stand-ins?scope=all — your own (as the absent approver or the stand-in), or everyone's
// for managers. Ended arrangements from the last 90 days are included for reference.
standInsRouter.get("/", async (req, res) => {
  const all = req.query.scope === "all" && isManager(req);
  const recent = new Date(today().getTime() - MAX_DAYS * 86_400_000);
  const rows = await prisma.delegation.findMany({
    where: {
      endsOn: { gte: recent },
      ...(!all && { OR: [{ fromUserId: req.user!.id }, { toUserId: req.user!.id }] }),
    },
    orderBy: [{ startsOn: "desc" }, { createdAt: "desc" }],
    include: standInInclude,
  });
  res.json({ items: rows.map((r) => toStandIn(r)) });
});

// GET /api/stand-ins/candidates — people who can stand in: active users with the approvals screen.
standInsRouter.get("/candidates", async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { status: "Active" },
    select: { id: true, name: true, role: true, department: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  res.json({ items: users.filter((u) => can(u.role, "approvals")).map((u) => ({ id: u.id, name: u.name, role: u.role, department: u.department.name })) });
});

// POST /api/stand-ins { fromUserId?, toUserId, startsOn, endsOn, reason? }
standInsRouter.post("/", async (req, res) => {
  const input = standInSchema.parse(req.body);
  const fromUserId = input.fromUserId ?? req.user!.id;
  if (fromUserId !== req.user!.id && !isManager(req)) throw forbidden("You can only arrange a stand-in for yourself");

  const [from, to] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, name: true, role: true, status: true } }),
    prisma.user.findUnique({ where: { id: input.toUserId }, select: { id: true, name: true, email: true, role: true, status: true } }),
  ]);
  const bad = (field: string, message: string) => new AppError(400, "VALIDATION_ERROR", message, { [field]: message });
  if (!from || from.status !== "Active") throw bad("fromUserId", "That approver isn't an active user");
  if (!isApproverRole(from.role)) throw bad("fromUserId", `${ROLE_LABELS[from.role]}s don't approve changes, so they don't need a stand-in`);
  if (!to || to.status !== "Active") throw bad("toUserId", "Choose an active user");
  if (to.id === from.id) throw bad("toUserId", "Choose someone else to stand in");
  if (!can(to.role, "approvals")) throw bad("toUserId", "Choose someone who approves changes");
  if (input.endsOn < today().toISOString().slice(0, 10)) throw bad("endsOn", "The end date has already passed");
  if ((day(input.endsOn).getTime() - day(input.startsOn).getTime()) / 86_400_000 + 1 > MAX_DAYS) {
    throw bad("endsOn", `A stand-in can cover at most ${MAX_DAYS} days`);
  }
  const overlap = await prisma.delegation.findFirst({
    where: { fromUserId: from.id, revokedAt: null, startsOn: { lte: day(input.endsOn) }, endsOn: { gte: day(input.startsOn) } },
    include: { toUser: { select: { name: true } } },
  });
  if (overlap) throw new AppError(409, "OVERLAP", `${from.name} already has ${overlap.toUser.name} standing in for some of those dates`);

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.delegation.create({
      data: { fromUserId: from.id, toUserId: to.id, startsOn: day(input.startsOn), endsOn: day(input.endsOn), reason: input.reason || null, createdById: req.user!.id },
      include: standInInclude,
    });
    await writeAudit({
      action: `Stand-in arranged: ${to.name} covers ${from.name} (${ROLE_LABELS[from.role]}), ${input.startsOn} – ${input.endsOn}`,
      category: "config", user: req.user!, ip: req.ip,
    }, tx);
    return row;
  });
  sendMail(emails.standIn([to.email], from.name, ROLE_LABELS[from.role], label(input.startsOn), label(input.endsOn), input.reason));
  res.status(201).json(toStandIn(created));
});

// DELETE /api/stand-ins/:id — end it now (kept for the record). The absent approver, whoever
// arranged it, or a manager.
standInsRouter.delete("/:id", async (req, res) => {
  const d = await prisma.delegation.findUnique({ where: { id: String(req.params.id) }, include: standInInclude });
  if (!d) throw notFound("Stand-in");
  const mine = d.fromUserId === req.user!.id || d.createdById === req.user!.id;
  if (!mine && !isManager(req)) throw forbidden("Only the approver, whoever arranged it, or an administrator can end this stand-in");
  if (d.revokedAt) throw new AppError(409, "INVALID_STATE", "This stand-in has already ended");
  await prisma.$transaction(async (tx) => {
    await tx.delegation.update({ where: { id: d.id }, data: { revokedAt: new Date() } });
    await writeAudit({ action: `Stand-in ended: ${d.toUser.name} no longer covers ${d.fromUser.name}`, category: "config", user: req.user!, ip: req.ip }, tx);
  });
  res.status(204).end();
});
