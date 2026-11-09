import {
  CHANGE_STATUSES, CHANGE_STATUS_LABELS, MAX_ATTACHMENTS_PER_CHANGE, ROLE_LABELS, attachmentProblem, calcRisk, changeCreateSchema, overrideReasonSchema, tierFor,
  type ChangeDetail, type ChangeDraftInput, type ChangeListQuery, type ChangeStatus, type ChangeUpdateInput,
  type CommentInput, type DecisionInput, type Level, type PirInput, type Role,
} from "@crms/shared";
import { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { AppError, forbidden, notFound } from "../../lib/errors";
import { writeAudit } from "../../services/audit";
import { isoDate, routeFor } from "../../services/routing";
import { deleteUpload, readUpload, saveUpload } from "../../lib/uploads";
import { detailInclude, listInclude, toDetail, toListItem } from "./dto";
import { notifyComment, notifyDecision, notifyStageReached } from "../../services/notify";
import { allowedActions, applyDecision, buildSteps, isImplementerOf, pendingStep, standInCover } from "./rules";

type Tx = Prisma.TransactionClient;
export type Actor = { id: string; name: string; role: Role; ip?: string; standInFor?: { userId: string; name: string; role: Role }[] };

/** 409: the request is fine, but the change is in the wrong state for it. */
const conflict = (message: string) => new AppError(409, "INVALID_STATE", message);

/** Pick 403 (wrong person) or 409 (right person, wrong moment) for a refused action. */
function refuse(rightPerson: boolean, stateMessage: string, personMessage: string): never {
  throw rightPerson ? conflict(stateMessage) : forbidden(personMessage);
}

const DEFAULT_TASKS = ["Confirm window", "Implement change", "Verify outcome", "Notify stakeholders"];
const day = (iso: string) => new Date(iso + "T00:00:00Z");
const statusLabel = (s: ChangeStatus) => CHANGE_STATUS_LABELS[s].toLowerCase();

/**
 * Requesters see only their own changes. Everyone else sees all changes
 * except other people's drafts, which stay private until submitted.
 */
export function visibleTo(u: Actor): Prisma.ChangeWhereInput {
  return u.role === "requester" ? { requesterId: u.id } : { OR: [{ status: { not: "Draft" } }, { requesterId: u.id }] };
}

// ------------------------------------------------------------------ reads

/** The list's filters and sort as Prisma arguments. Shared by the list and the CSV export. */
function listArgs(u: Actor, q: Omit<ChangeListQuery, "page" | "pageSize">) {
  const filters: Prisma.ChangeWhereInput = {
    AND: [
      visibleTo(u),
      {
        ...(q.departmentId && { departmentId: q.departmentId }),
        ...(q.typeId && { typeId: q.typeId }),
        ...(q.implementerId && { implementerId: q.implementerId }),
        ...(q.requesterId && { requesterId: q.requesterId }),
        ...(q.tier && { tier: q.tier }),
        ...(q.q && { OR: [{ ref: { contains: q.q } }, { title: { contains: q.q } }] }),
      },
    ],
  };
  const where: Prisma.ChangeWhereInput = q.status ? { AND: [filters, { status: q.status }] } : filters;
  const orderBy: Prisma.ChangeOrderByWithRelationInput[] = {
    planned: [{ plannedDate: "asc" as const }, { ref: "asc" as const }],
    newest: [{ createdAt: "desc" as const }],
    risk: [{ tier: "desc" as const }, { plannedDate: "asc" as const }], // enum order: Emergency, High, Medium, Low
    ref: [{ ref: "desc" as const }],
  }[q.sort];
  return { filters, where, orderBy };
}

export async function listChanges(u: Actor, q: ChangeListQuery) {
  const { filters, where, orderBy } = listArgs(u, q);
  const [rows, total, byStatus] = await Promise.all([
    prisma.change.findMany({ where, orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize, include: listInclude }),
    prisma.change.count({ where }),
    // Counts per status for the filter chips, ignoring the status filter itself.
    prisma.change.groupBy({ by: ["status"], where: filters, _count: { _all: true } }),
  ]);

  const counts = Object.fromEntries(CHANGE_STATUSES.map((s) => [s, 0])) as Record<ChangeStatus, number>;
  for (const g of byStatus) counts[g.status] = g._count._all;

  return { items: rows.map(toListItem), total, page: q.page, pageSize: q.pageSize, counts };
}

const EXPORT_LIMIT = 5000;

/** Everything matching the list filters (up to 5,000 rows) as CSV rows. The export is audited. */
export async function exportChanges(u: Actor, q: Omit<ChangeListQuery, "page" | "pageSize">) {
  const { where, orderBy } = listArgs(u, q);
  const rows = await prisma.change.findMany({ where, orderBy, take: EXPORT_LIMIT, include: listInclude });
  await writeAudit({ action: "Exported change requests (CSV)", category: "export", user: u, ip: u.ip, meta: { rows: rows.length, filters: q } });

  const header = ["Reference", "Title", "Status", "Risk tier", "Risk score", "Type", "Department", "Requester", "Implementer", "Planned date", "Window", "Current stage", "Created"];
  return [
    header,
    ...rows.map(toListItem).map((c) => [
      c.ref, c.title, CHANGE_STATUS_LABELS[c.status], c.tier, c.score, c.type.label, c.department.name,
      c.requester.name, c.implementer?.name ?? "", c.plannedDate ?? "", c.window ?? "",
      c.currentStage ? `${c.currentStage.label} (${c.currentStage.index}/${c.currentStage.total})` : "", c.createdAt.slice(0, 10),
    ]),
  ];
}

export async function getChange(u: Actor, ref: string, db: Tx | typeof prisma = prisma) {
  const c = await db.change.findFirst({ where: { AND: [{ ref }, visibleTo(u)] }, include: detailInclude });
  if (!c) throw notFound("Change request"); // also for changes you may not see, so their existence isn't revealed
  const activity = await db.auditLog.findMany({
    where: { ref },
    orderBy: { at: "desc" },
    select: { id: true, at: true, userName: true, role: true, action: true, category: true },
  });
  const detail: ChangeDetail = { ...toDetail(c, u), activity: activity.map((a) => ({ ...a, at: a.at.toISOString() })) };
  return detail;
}

/**
 * Changes waiting at this user's stage that they did not raise, plus stages they can decide
 * as a stand-in today (never for the change's own requester).
 */
export async function inbox(u: Actor) {
  const covering = u.standInFor ?? [];
  const roles = [...new Set([u.role, ...covering.map((s) => s.role)])];
  const rows = await prisma.change.findMany({
    where: {
      status: "PendingApproval",
      requesterId: { not: u.id },
      steps: { some: { status: "pending", role: { in: roles } } },
    },
    orderBy: [{ plannedDate: "asc" }, { ref: "asc" }],
    include: listInclude,
  });
  return rows.filter((c) => pendingStep(c.steps)?.role === u.role || standInCover(c, u)).map(toListItem);
}

export async function routePreview(q: { departmentId: string; impact: Level; likelihood: Level; emergency: boolean; plannedDate?: string }) {
  const tier = tierFor(q.impact, q.likelihood, q.emergency);
  const { route, freeze } = await routeFor(prisma, { departmentId: q.departmentId, tier, plannedDate: q.plannedDate });
  return { tier, ...calcRisk(q.impact, q.likelihood), route: route.map((role) => ({ role, label: ROLE_LABELS[role] })), freeze: freeze ?? null };
}

// ------------------------------------------------------------------ writes

/** Loads a change for an action inside a transaction, applying the same visibility rule as reads. */
async function loadForAction(tx: Tx, ref: string, u: Actor) {
  const c = await tx.change.findFirst({ where: { AND: [{ ref }, visibleTo(u)] }, include: detailInclude });
  if (!c) throw notFound("Change request");
  return c;
}

/** 400 if a referenced type, department or implementer doesn't exist or is inactive. */
async function assertRefs(tx: Tx, d: { typeId?: string; departmentId?: string; implementerId?: string }) {
  const bad = (field: string, message: string) => new AppError(400, "INVALID_REFERENCE", `${field}: ${message}`);
  if (d.typeId && !(await tx.changeType.findFirst({ where: { id: d.typeId, active: true } }))) throw bad("typeId", "unknown or inactive change type");
  if (d.departmentId && !(await tx.department.findFirst({ where: { id: d.departmentId, active: true } }))) throw bad("departmentId", "unknown or inactive department");
  if (d.implementerId && !(await tx.user.findFirst({ where: { id: d.implementerId, status: "Active" } }))) throw bad("implementerId", "unknown or inactive user");
}

/** Next CHG-<year>-NNNN for the current year. */
async function nextRef(tx: Tx) {
  const year = new Date().getFullYear();
  const last = await tx.change.findFirst({ where: { ref: { startsWith: `CHG-${year}-` } }, orderBy: { ref: "desc" }, select: { ref: true } });
  const n = last ? Number(last.ref.slice(-4)) + 1 : 1;
  return `CHG-${year}-${String(n).padStart(4, "0")}`;
}

/** Two requests could compute the same next ref; the unique index rejects one, so retry it. */
async function withRefRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const duplicate = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!duplicate || attempt >= 3) throw e;
    }
  }
}

export async function createChange(u: Actor, d: ChangeDraftInput, submit: boolean) {
  const ref = await withRefRetry(() =>
    prisma.$transaction(async (tx) => {
      await assertRefs(tx, d);
      const ref = await nextRef(tx);
      const impact = d.impact ?? 2, likelihood = d.likelihood ?? 1, emergency = d.emergency ?? false;
      await tx.change.create({
        data: {
          ref,
          title: d.title ?? "Untitled change",
          summary: d.summary ?? "",
          reason: d.reason ?? "",
          typeId: d.typeId,
          departmentId: d.departmentId,
          emergency, impact, likelihood,
          tier: tierFor(impact as Level, likelihood as Level, emergency),
          customerFacing: d.customerFacing ?? false,
          regulatory: d.regulatory ?? false,
          personalData: d.personalData ?? false,
          systems: d.systems ?? [],
          plannedDate: d.plannedDate ? day(d.plannedDate) : null,
          window: d.window, testPlan: d.testPlan, rollbackPlan: d.rollbackPlan,
          implementerId: d.implementerId,
          requesterId: u.id,
          status: "Draft",
          tasks: { create: DEFAULT_TASKS.map((label, order) => ({ label, order })) },
        },
      });
      await writeAudit({ action: "Saved draft", category: "change", user: u, ref, ip: u.ip }, tx);
      if (submit) await submitInTx(tx, u, ref);
      return ref;
    }),
  );
  if (submit) notifyStageReached(ref);
  return getChange(u, ref);
}

export async function updateChange(u: Actor, ref: string, d: ChangeUpdateInput) {
  await prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, ref, u);
    if (!allowedActions(c, u).edit) {
      refuse(c.requesterId === u.id, `A change that is ${statusLabel(c.status)} can no longer be edited`, "Only the requester can edit this change");
    }
    await assertRefs(tx, d);
    const impact = d.impact ?? c.impact, likelihood = d.likelihood ?? c.likelihood, emergency = d.emergency ?? c.emergency;
    await tx.change.update({
      where: { id: c.id },
      data: {
        ...d,
        plannedDate: d.plannedDate === undefined ? undefined : day(d.plannedDate),
        tier: tierFor(impact as Level, likelihood as Level, emergency),
      },
    });
    await writeAudit({ action: "Updated change request", category: "change", user: u, ref, ip: u.ip, meta: { fields: Object.keys(d) } }, tx);
  });
  return getChange(u, ref);
}

/** Validates that the draft is complete, builds its approval route and sends it to the first stage. */
async function submitInTx(tx: Tx, u: Actor, ref: string) {
  const c = await loadForAction(tx, ref, u);
  if (!allowedActions(c, u).submit) {
    refuse(c.requesterId === u.id, `A change that is ${statusLabel(c.status)} cannot be submitted`, "Only the requester can submit this change");
  }

  // Same schema as the wizard: a half-finished draft gets field-by-field 400 errors.
  changeCreateSchema.parse({
    typeId: c.typeId, departmentId: c.departmentId, emergency: c.emergency,
    title: c.title, summary: c.summary, reason: c.reason, systems: c.systems,
    impact: c.impact, likelihood: c.likelihood,
    customerFacing: c.customerFacing, regulatory: c.regulatory, personalData: c.personalData,
    plannedDate: c.plannedDate ? isoDate(c.plannedDate) : undefined,
    window: c.window ?? undefined, implementerId: c.implementerId ?? undefined,
    testPlan: c.testPlan ?? undefined, rollbackPlan: c.rollbackPlan ?? "",
    attest: true,
  });

  // The server always works out the tier and route itself; nothing from the client is trusted.
  const tier = tierFor(c.impact as Level, c.likelihood as Level, c.emergency);
  const { route, freeze } = await routeFor(tx, {
    departmentId: c.departmentId, tier, plannedDate: c.plannedDate ? isoDate(c.plannedDate) : undefined,
  });

  // A resubmission starts a fresh route. The earlier decisions stay in the audit trail.
  await tx.approvalStep.deleteMany({ where: { changeId: c.id } });
  const now = new Date();
  await tx.approvalStep.createMany({ data: buildSteps(route).map((s) => ({ ...s, changeId: c.id, pendingSince: s.order === 0 ? now : null })) });
  await tx.change.update({ where: { id: c.id }, data: { status: "PendingApproval", tier, submittedAt: new Date() } });

  const action = c.status === "ReturnedForRework" ? "Resubmitted change request" : "Submitted change request";
  await writeAudit({ action, category: "change", user: u, ref, ip: u.ip, meta: { tier, route, freeze: freeze?.name } }, tx);
}

export async function submitChange(u: Actor, ref: string) {
  await prisma.$transaction((tx) => submitInTx(tx, u, ref));
  notifyStageReached(ref);
  return getChange(u, ref);
}

export async function decideChange(u: Actor, ref: string, input: DecisionInput) {
  await prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, ref, u);
    const acts = allowedActions(c, u);
    const viaOverride = !acts.decide && acts.override;
    if (!acts.decide && !acts.override) {
      if (c.status !== "PendingApproval") throw conflict("This change is not awaiting approval");
      if (acts.sodBlocked) throw forbidden("You cannot approve a change you raised");
      if (u.role === "superAdmin") {
        throw forbidden("A super admin can only override a stage the requester is blocked from approving, and never on their own change");
      }
      throw forbidden(`This change is waiting at the ${ROLE_LABELS[pendingStep(c.steps)!.role]} stage`);
    }
    if (viaOverride) overrideReasonSchema.parse({ comment: input.comment }); // 400 if no reason
    // Deciding someone else's stage as their stand-in (not your own role's stage).
    const cover = !viaOverride ? standInCover(c, u) : undefined;

    const { current, updates, status } = applyDecision(c, input.kind);
    const now = new Date();
    for (const upd of updates) {
      if (upd.id === current.id) {
        // Only succeeds if the step is still pending, so two approvers clicking at
        // the same moment can't both decide it.
        const res = await tx.approvalStep.updateMany({
          where: { id: current.id, status: "pending" },
          data: { status: upd.status, decidedById: u.id, decidedAt: now, comment: input.comment || null, overridden: viaOverride, onBehalfOfId: cover?.userId ?? null },
        });
        if (res.count !== 1) throw conflict("This stage was just decided by someone else. Reload and try again.");
      } else {
        // The next stage starts waiting now (for reminders); skipped stages just change status.
        await tx.approvalStep.update({ where: { id: upd.id }, data: { status: upd.status, ...(upd.status === "pending" && { pendingSince: now }) } });
      }
    }
    await tx.change.update({ where: { id: c.id }, data: { status } });

    const verb = { approve: "Approved", reject: "Rejected", return: "Returned for rework" }[input.kind];
    // Overrides get their own wording so they stand out when the audit trail is reviewed.
    await writeAudit({
      action: `${verb}${viaOverride ? " (override)" : ""} at ${ROLE_LABELS[current.role]} stage${cover ? ` (stand-in for ${cover.name})` : ""}`,
      category: "decision", user: u, ref, ip: u.ip,
      meta: viaOverride
        ? { override: true, reason: input.comment }
        : { ...(input.comment && { comment: input.comment }), ...(cover && { onBehalfOf: cover.userId }) },
    }, tx);
  });
  notifyDecision(ref, input.kind, u.name, input.comment);
  return getChange(u, ref);
}

export async function startChange(u: Actor, ref: string) {
  await prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, ref, u);
    if (!allowedActions(c, u).start) {
      refuse(isImplementerOf(c, u), `A change that is ${statusLabel(c.status)} cannot be started`, "Only the assigned implementer or the Change Manager can start this change");
    }
    await tx.change.update({ where: { id: c.id }, data: { status: "InProgress" } });
    await writeAudit({ action: "Started implementation", category: "change", user: u, ref, ip: u.ip }, tx);
  });
  return getChange(u, ref);
}

export async function setTask(u: Actor, ref: string, taskId: string, done: boolean) {
  await prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, ref, u);
    if (!allowedActions(c, u).updateTasks) {
      refuse(isImplementerOf(c, u), "The checklist unlocks once implementation has started", "Only the assigned implementer or the Change Manager can update the checklist");
    }
    const task = c.tasks.find((t) => t.id === taskId);
    if (!task) throw notFound("Checklist item");
    await tx.checklistTask.update({
      where: { id: task.id },
      data: done ? { done: true, doneAt: new Date(), doneById: u.id } : { done: false, doneAt: null, doneById: null },
    });
    await writeAudit({ action: `${done ? "Completed" : "Reopened"} checklist item: ${task.label}`, category: "change", user: u, ref, ip: u.ip }, tx);
  });
  return getChange(u, ref);
}

export async function markImplemented(u: Actor, ref: string) {
  await prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, ref, u);
    if (!allowedActions(c, u).markImplemented) {
      const msg = c.status === "InProgress" ? "Complete every checklist item first" : `A change that is ${statusLabel(c.status)} cannot be marked implemented`;
      refuse(isImplementerOf(c, u), msg, "Only the assigned implementer or the Change Manager can mark this change implemented");
    }
    await tx.change.update({ where: { id: c.id }, data: { status: "Implemented" } });
    await writeAudit({ action: "Marked as implemented", category: "change", user: u, ref, ip: u.ip }, tx);
  });
  return getChange(u, ref);
}

export async function reviewChange(u: Actor, ref: string, pir: PirInput) {
  await prisma.$transaction(async (tx) => {
    const c = await loadForAction(tx, ref, u);
    if (!allowedActions(c, u).review) {
      refuse(u.role === "changeManager", "The review opens after the change has been implemented", "Only the Change Manager can complete the post-implementation review");
    }
    await tx.postImplementationReview.create({ data: { changeId: c.id, outcome: pir.outcome, notes: pir.notes, reviewedById: u.id } });
    await tx.change.update({ where: { id: c.id }, data: { status: "Closed" } });
    await writeAudit({ action: "Completed post-implementation review & closed", category: "change", user: u, ref, ip: u.ip, meta: { outcome: pir.outcome } }, tx);
  });
  return getChange(u, ref);
}

// ------------------------------------------------------------------ discussion

/** Anyone who can see the change can comment. Comments can't be edited, like the audit trail. */
export async function addComment(u: Actor, ref: string, input: CommentInput) {
  const c = await prisma.change.findFirst({ where: { AND: [{ ref }, visibleTo(u)] }, select: { id: true } });
  if (!c) throw notFound("Change request");
  await prisma.$transaction(async (tx) => {
    await tx.comment.create({ data: { changeId: c.id, authorId: u.id, body: input.body } });
    await writeAudit({ action: "Commented", category: "change", user: u, ref, ip: u.ip, meta: { length: input.body.length } }, tx);
  });
  notifyComment(ref, u.id, u.name, input.body);
  return getChange(u, ref);
}

// ------------------------------------------------------------------ attachments

export type UploadedFile = { originalname: string; mimetype: string; size: number; buffer: Buffer };

/** Checks every file first, writes them to disk, then records them (and the audit entry) together. */
export async function addAttachments(u: Actor, ref: string, files: UploadedFile[]) {
  if (!files.length) throw new AppError(400, "NO_FILES", "Choose at least one file");
  const c = await prisma.change.findFirst({ where: { AND: [{ ref }, visibleTo(u)] }, include: detailInclude });
  if (!c) throw notFound("Change request");
  if (!allowedActions(c, u).attach) {
    refuse(c.requesterId === u.id, `Files can't be added once a change is ${statusLabel(c.status)}`, "Only the requester can add files to this change");
  }
  const problems = files.map((f) => attachmentProblem(f.originalname, f.mimetype, f.size)).filter(Boolean);
  if (problems.length) throw new AppError(400, "BAD_FILE", problems.join("; "));
  if (c.attachments.length + files.length > MAX_ATTACHMENTS_PER_CHANGE) {
    throw new AppError(409, "TOO_MANY_FILES", `A change can have at most ${MAX_ATTACHMENTS_PER_CHANGE} files (it has ${c.attachments.length})`);
  }

  const saved: { key: string; f: UploadedFile }[] = [];
  try {
    for (const f of files) saved.push({ key: await saveUpload(c.id, f.originalname, f.buffer), f });
    await prisma.$transaction(async (tx) => {
      await tx.attachment.createMany({
        data: saved.map(({ key, f }) => ({ changeId: c.id, fileName: cleanName(f.originalname), sizeBytes: f.size, storageKey: key })),
      });
      await writeAudit({ action: `Attached ${saved.length === 1 ? `file: ${cleanName(files[0]!.originalname)}` : `${saved.length} files`}`, category: "change", user: u, ref, ip: u.ip, meta: { files: saved.map((s) => cleanName(s.f.originalname)) } }, tx);
    });
  } catch (e) {
    await Promise.all(saved.map((s) => deleteUpload(s.key))); // don't leave orphaned files behind
    throw e;
  }
  return getChange(u, ref);
}

export async function removeAttachment(u: Actor, ref: string, attachmentId: string) {
  const c = await prisma.change.findFirst({ where: { AND: [{ ref }, visibleTo(u)] }, include: detailInclude });
  if (!c) throw notFound("Change request");
  const a = c.attachments.find((x) => x.id === attachmentId);
  if (!a) throw notFound("Attachment");
  if (!allowedActions(c, u).removeAttachment) {
    refuse(c.requesterId === u.id, "Files can only be removed while the request is a draft or returned for rework", "Only the requester can remove files");
  }
  await prisma.$transaction(async (tx) => {
    await tx.attachment.delete({ where: { id: a.id } });
    await writeAudit({ action: `Removed attachment: ${a.fileName}`, category: "change", user: u, ref, ip: u.ip }, tx);
  });
  await deleteUpload(a.storageKey);
  return getChange(u, ref);
}

/** The file for download — anyone who may see the change may download its files. */
export async function getAttachment(u: Actor, ref: string, attachmentId: string) {
  const a = await prisma.attachment.findFirst({ where: { id: attachmentId, change: { AND: [{ ref }, visibleTo(u)] } } });
  if (!a) throw notFound("Attachment");
  return { fileName: a.fileName, data: await readUpload(a.storageKey) };
}

/** Display name: no folders, no control characters, at most 150 characters. */
const cleanName = (name: string) => (name.split(/[\/]/).pop() ?? "file").replace(/[\u0000-\u001f]/g, "").slice(-150) || "file";
