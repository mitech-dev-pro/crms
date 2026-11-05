// Fills the database with the prototype's demo data.
// Run with:  npx prisma db seed   (from backend/)
// It wipes the tables first, so it is safe to re-run — DEV ONLY.
import "dotenv/config";
import { ROLE_LABELS } from "@crms/shared";
import bcrypt from "bcryptjs";
import type { ChangeStatus, PirOutcome } from "../src/generated/prisma/client";
import { createPrisma } from "../src/lib/prisma";
import {
  AUDIT, CHANGE_TYPES, CHANGES, DEMO_PASSWORD, DEPARTMENTS, FREEZES, OTHER_USERS, PERSONAS, WORKFLOWS,
  auditCategory, personaFor,
} from "./seed-data";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (see backend/.env.example)");
const prisma = createPrisma(process.env.DATABASE_URL);

const STATUS: Record<string, ChangeStatus> = {
  Draft: "Draft", "Pending approval": "PendingApproval", "Returned for rework": "ReturnedForRework",
  Approved: "Approved", Scheduled: "Scheduled", "In progress": "InProgress", Implemented: "Implemented",
  Closed: "Closed", Rejected: "Rejected",
};
const PIR: Record<string, PirOutcome> = { Successful: "Successful", "Successful with issues": "SuccessfulWithIssues" };

/** "15 Oct 2026, 09:12" → Date (local time). */
const ts = (s: string) => new Date(s.replace(",", ""));
/** "2026-11-05" → Date for a DATE column. */
const day = (s: string) => new Date(s + "T00:00:00Z");
/** "2.4 MB" / "318 KB" → bytes */
const bytes = (s: string) => Math.round(parseFloat(s) * (s.endsWith("MB") ? 1024 * 1024 : 1024));

async function main() {
  console.log("Clearing tables…");
  // Order matters: children before parents. Deleting a change cascades to its steps, tasks, files and PIR.
  await prisma.auditLog.deleteMany();
  await prisma.change.deleteMany();
  await prisma.workflowStage.deleteMany();
  await prisma.freezeWindow.deleteMany();
  await prisma.changeType.deleteMany();
  await prisma.user.deleteMany(); // department head/line-manager links are set to null automatically
  await prisma.department.deleteMany();

  console.log("Departments, types, freezes…");
  for (const [code, name] of DEPARTMENTS) await prisma.department.create({ data: { code, name } });
  const deptId = Object.fromEntries((await prisma.department.findMany()).map((d) => [d.name, d.id]));

  await prisma.changeType.createMany({ data: CHANGE_TYPES.map(([label, description]) => ({ label, description })) });
  const typeId = Object.fromEntries((await prisma.changeType.findMany()).map((t) => [t.label, t.id]));

  await prisma.freezeWindow.createMany({ data: FREEZES.map((f) => ({ name: f.name, from: day(f.from), to: day(f.to) })) });

  console.log("Users…");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const people = [
    ...PERSONAS.map((p) => ({ ...p, status: "Active" as const })),
    ...OTHER_USERS.map((u) => ({ ...u, title: undefined })),
  ];
  await prisma.user.createMany({
    data: people.map((p, i) => ({
      code: "USR-" + String(201 + i).padStart(4, "0"),
      name: p.name,
      email: p.name.toLowerCase().replace(/ /g, ".") + "@milife.com.gh",
      title: p.title,
      role: p.role,
      status: p.status,
      passwordHash: p.status === "Invited" ? null : passwordHash, // invited users have not set a password yet
      departmentId: deptId[p.dept]!,
    })),
  });
  const userId = Object.fromEntries((await prisma.user.findMany()).map((u) => [u.name, u.id]));
  const uid = (name: string) => {
    const id = userId[name];
    if (!id) throw new Error(`Seed data references unknown user "${name}"`);
    return id;
  };

  // Now that users exist, link each department to its head and line manager.
  for (const [, name, head, lm] of DEPARTMENTS) {
    await prisma.department.update({ where: { name }, data: { headId: uid(head), lineManagerId: uid(lm) } });
  }

  console.log("Workflows…");
  await prisma.workflowStage.createMany({
    data: WORKFLOWS.flatMap(({ dept, routes }) =>
      Object.entries(routes).flatMap(([tier, roles]) =>
        roles.map((role, order) => ({
          departmentId: dept ? deptId[dept]! : null,
          tier: tier as keyof typeof routes,
          order,
          role,
        })),
      ),
    ),
  });

  console.log("Changes…");
  for (const c of CHANGES) {
    const decided = c.steps.filter((st) => st.at);
    await prisma.change.create({
      data: {
        ref: c.ref, title: c.title, summary: c.summary, reason: c.reason,
        typeId: typeId[c.type]!, departmentId: deptId[c.dept]!,
        emergency: c.tier === "Emergency", impact: c.impact, likelihood: c.likelihood, tier: c.tier,
        customerFacing: c.customer, regulatory: c.regulatory, personalData: c.data, systems: c.systems,
        plannedDate: day(c.date), window: c.window, testPlan: c.test, rollbackPlan: c.rollback,
        status: STATUS[c.status]!,
        requesterId: uid(c.requester),
        implementerId: c.implementer ? uid(c.implementer) : null,
        createdAt: day(c.created),
        submittedAt: c.status === "Draft" ? null : decided[0] ? ts(decided[0].at!) : day(c.created),
        steps: {
          create: c.steps.map((st, order) => ({
            order, role: st.role, status: st.status, comment: st.comment,
            decidedAt: st.at ? ts(st.at) : null,
            decidedById: st.at ? uid(personaFor(st.role)) : null,
          })),
        },
        tasks: {
          create: c.tasks.map((t, order) => ({
            order, label: t.label, done: t.done,
            doneById: t.done && c.implementer ? uid(c.implementer) : null,
          })),
        },
        attachments: {
          create: (c.files ?? []).map((f) => ({ fileName: f.name, sizeBytes: bytes(f.size), storageKey: `seed/${c.ref}/${f.name}` })),
        },
        pir: c.pir
          ? { create: { outcome: PIR[c.pir.outcome]!, notes: c.pir.notes, reviewedById: uid("Yaw Owusu"), reviewedAt: ts(c.pir.at) } }
          : undefined,
      },
    });
  }

  console.log("Audit trail…");
  const events = [...AUDIT];
  // Historical changes get an approval event and a closing/rejection event, as in the prototype.
  for (const c of CHANGES.filter((x) => x.ref < "CHG-2026-0128")) {
    const first = c.steps[0]!, last = c.steps[c.steps.length - 1]!;
    events.push({ ts: first.at!, user: personaFor(first.role), role: first.role, action: `Approved at ${ROLE_LABELS[first.role]} stage`, ref: c.ref, ip: "10.20.8.20" });
    if (c.status === "Closed") {
      events.push({ ts: c.pir!.at, user: "Yaw Owusu", role: "changeManager", action: "Completed post-implementation review & closed", ref: c.ref, ip: "10.20.4.18" });
    } else {
      events.push({ ts: last.at!, user: personaFor(last.role), role: last.role, action: `Rejected at ${ROLE_LABELS[last.role]} stage`, ref: c.ref, ip: "10.20.3.77" });
    }
  }
  await prisma.auditLog.createMany({
    data: events.map((e) => ({
      at: ts(e.ts), userId: uid(e.user), userName: e.user, role: e.role, action: e.action,
      category: auditCategory(e.action), ref: e.ref === "—" ? null : e.ref, ip: e.ip,
    })),
  });

  const counts = {
    departments: await prisma.department.count(), users: await prisma.user.count(), changeTypes: await prisma.changeType.count(),
    workflowStages: await prisma.workflowStage.count(), freezes: await prisma.freezeWindow.count(),
    changes: await prisma.change.count(), approvalSteps: await prisma.approvalStep.count(),
    tasks: await prisma.checklistTask.count(), attachments: await prisma.attachment.count(),
    reviews: await prisma.postImplementationReview.count(), auditLogs: await prisma.auditLog.count(),
  };
  console.log("Seeded:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
