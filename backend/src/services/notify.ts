// Who gets which email when something happens to a change. Called after the database
// transaction commits, in the background (inBackground), so a slow mail server never
// slows down or fails the action itself.
import { ROLE_LABELS, type Role } from "@crms/shared";
import { prisma } from "../lib/db";
import { inBackground, sendMail } from "../lib/mail";
import { emails } from "./emails";
import { isoDate } from "./routing";
import { standInEmailsFor } from "./standins";

const changeSelect = {
  id: true, ref: true, title: true, tier: true, plannedDate: true, window: true, status: true, requesterId: true,
  requester: { select: { id: true, name: true, email: true } },
  department: { select: { name: true } },
  implementer: { select: { id: true, email: true, status: true } },
  steps: { where: { status: "pending" as const }, select: { role: true } },
} as const;

async function load(ref: string) {
  const c = await prisma.change.findUnique({ where: { ref }, select: changeSelect });
  if (!c) return null;
  const info = {
    ref: c.ref, title: c.title, requester: c.requester.name, department: c.department.name, tier: c.tier,
    plannedDate: c.plannedDate ? isoDate(c.plannedDate) : null,
  };
  return { c, info };
}

/**
 * Everyone who can decide a stage of this role: active users holding it, plus anyone
 * standing in for them today. Never the requester (segregation of duties).
 */
export async function approverEmails(role: Role, requesterId: string) {
  const holders = await prisma.user.findMany({ where: { role, status: "Active", id: { not: requesterId } }, select: { id: true, email: true } });
  const standIns = await standInEmailsFor(holders.map((h) => h.id));
  return [...new Set([...holders.map((h) => h.email), ...standIns])];
}

/** The change reached a new approval stage: tell whoever can decide it. */
export function notifyStageReached(ref: string) {
  inBackground(
    (async () => {
      const l = await load(ref);
      const role = l?.c.steps[0]?.role;
      if (!l || !role || l.c.status !== "PendingApproval") return;
      sendMail(emails.needsApproval(await approverEmails(role, l.c.requesterId), l.info, ROLE_LABELS[role]));
    })(),
    `stage email for ${ref}`,
  );
}

/** A stage was decided. The next stage's approvers hear about it via notifyStageReached. */
export function notifyDecision(ref: string, kind: "approve" | "reject" | "return", by: string, comment?: string | null) {
  inBackground(
    (async () => {
      const l = await load(ref);
      if (!l) return;
      const { c, info } = l;
      if (kind === "approve" && c.status === "PendingApproval") return notifyStageReached(ref); // more stages to go
      const outcome = kind === "reject" ? "rejected" : kind === "return" ? "returned" : c.status === "Scheduled" ? "scheduled" : "approved";
      sendMail(emails.decided([c.requester.email], info, outcome, by, comment));
      // Fully approved: the implementer can get ready.
      if (kind === "approve" && c.implementer && c.implementer.status === "Active" && c.implementer.id !== c.requesterId) {
        sendMail(emails.readyToImplement([c.implementer.email], info, c.window));
      }
    })(),
    `decision email for ${ref}`,
  );
}

/** A new comment: tell the requester and everyone who decided or commented, except the author. */
export function notifyComment(ref: string, authorId: string, authorName: string, body: string) {
  inBackground(
    (async () => {
      const l = await load(ref);
      if (!l) return;
      const [deciders, commenters] = await Promise.all([
        prisma.approvalStep.findMany({ where: { changeId: l.c.id, decidedById: { not: null } }, select: { decidedBy: { select: { id: true, email: true, status: true } } } }),
        prisma.comment.findMany({ where: { changeId: l.c.id }, select: { author: { select: { id: true, email: true, status: true } } } }),
      ]);
      const people = [l.c.requester, ...deciders.map((d) => d.decidedBy!), ...commenters.map((m) => m.author)];
      const to = people.filter((p) => p.id !== authorId && (!("status" in p) || p.status === "Active")).map((p) => p.email);
      sendMail(emails.comment(to, l.info, authorName, body));
    })(),
    `comment email for ${ref}`,
  );
}
