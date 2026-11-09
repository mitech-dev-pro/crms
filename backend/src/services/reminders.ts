// Chasing late approvals. A stage waiting longer than DECISION_DUE_DAYS working days gets one
// reminder to its approvers (and their stand-ins); after ESCALATE_AFTER_DAYS the Change
// Manager(s) are alerted too. Each step is reminded and escalated at most once.
import { DECISION_DUE_DAYS, ESCALATE_AFTER_DAYS, ROLE_LABELS, addWorkingDays, workingDaysBetween } from "@crms/shared";
import { env } from "../config/env";
import { prisma } from "../lib/db";
import { sendMail } from "../lib/mail";
import { writeAudit } from "./audit";
import { emails } from "./emails";
import { approverEmails } from "./notify";
import { isoDate } from "./routing";

const SYSTEM = "ChangeHub (automatic)";

/** One pass over every waiting stage. Safe to run often: each step is claimed before emailing. */
export async function runReminders(now = new Date()) {
  const steps = await prisma.approvalStep.findMany({
    where: { status: "pending", change: { status: "PendingApproval" }, OR: [{ remindedAt: null }, { escalatedAt: null }] },
    include: {
      change: {
        select: {
          ref: true, title: true, tier: true, plannedDate: true, submittedAt: true, requesterId: true,
          requester: { select: { name: true } }, department: { select: { name: true } },
        },
      },
    },
  });
  let reminded = 0, escalated = 0;

  for (const s of steps) {
    const since = s.pendingSince ?? s.change.submittedAt;
    if (!since) continue;
    const c = s.change;
    const info = { ref: c.ref, title: c.title, requester: c.requester.name, department: c.department.name, tier: c.tier, plannedDate: c.plannedDate ? isoDate(c.plannedDate) : null };
    const stage = ROLE_LABELS[s.role];
    const waited = workingDaysBetween(since, now);

    if (!s.remindedAt && now >= addWorkingDays(since, DECISION_DUE_DAYS)) {
      // updateMany with remindedAt: null is the claim: if two servers run this at once, only one wins.
      const claim = await prisma.approvalStep.updateMany({ where: { id: s.id, remindedAt: null }, data: { remindedAt: now } });
      if (claim.count === 1) {
        sendMail(emails.reminder(await approverEmails(s.role, c.requesterId), info, stage, waited));
        await writeAudit({ action: `Reminder sent: waiting ${waited} working days at ${stage} stage`, category: "change", userName: SYSTEM, ref: c.ref });
        reminded++;
      }
    }

    if (!s.escalatedAt && now >= addWorkingDays(since, ESCALATE_AFTER_DAYS)) {
      const claim = await prisma.approvalStep.updateMany({ where: { id: s.id, escalatedAt: null }, data: { escalatedAt: now } });
      if (claim.count === 1) {
        const managers = await prisma.user.findMany({ where: { role: "changeManager", status: "Active", id: { not: c.requesterId } }, select: { email: true } });
        sendMail(emails.escalation(managers.map((m) => m.email), info, stage, waited));
        await writeAudit({ action: `Escalated to Change Manager: waiting ${waited} working days at ${stage} stage`, category: "change", userName: SYSTEM, ref: c.ref });
        escalated++;
      }
    }
  }
  return { checked: steps.length, reminded, escalated };
}

/** Runs the reminder pass shortly after start-up, then every REMINDER_INTERVAL_MINUTES. */
export function startReminderSchedule() {
  if (!env.REMINDERS_ENABLED) return;
  const run = () =>
    runReminders()
      .then((r) => (r.reminded || r.escalated) && console.log(`[reminders] ${r.reminded} reminded, ${r.escalated} escalated`))
      .catch((e) => console.error("[reminders] failed:", e instanceof Error ? e.message : e));
  setTimeout(run, 60_000).unref();
  setInterval(run, env.REMINDER_INTERVAL_MINUTES * 60_000).unref(); // unref: never keeps the process alive on its own
}
