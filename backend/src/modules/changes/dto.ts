// What the API sends back for a change. Keeps database details (and anything
// sensitive) out of responses, and adds computed fields the UI needs.
// Return types come from @crms/shared, so the frontend's types always match.
import {
  ROLE_LABELS, calcRisk, type ChangeDetail, type ChangeListItem, type CurrentStage, type Level,
} from "@crms/shared";
import type { Prisma } from "../../generated/prisma/client";
import { isoDate } from "../../services/routing";
import { allowedActions, pendingStep, type Actor } from "./rules";

const person = { select: { id: true, name: true } } as const;
const iso = (d: Date) => d.toISOString();
const isoOrNull = (d: Date | null) => (d ? d.toISOString() : null);

/** Relations loaded for the list view. */
export const listInclude = {
  type: { select: { id: true, label: true } },
  department: { select: { id: true, name: true } },
  requester: person,
  implementer: person,
  steps: { orderBy: { order: "asc" }, select: { id: true, order: true, role: true, status: true } },
} satisfies Prisma.ChangeInclude;

/** Relations loaded for the detail view. */
export const detailInclude = {
  type: { select: { id: true, label: true } },
  department: { select: { id: true, name: true } },
  requester: { select: { id: true, name: true, role: true } }, // role: needed for the override rule
  implementer: person,
  steps: { orderBy: { order: "asc" }, include: { decidedBy: person } },
  tasks: { orderBy: { order: "asc" }, include: { doneBy: person } },
  attachments: { orderBy: { uploadedAt: "asc" } },
  pir: { include: { reviewedBy: person } },
} satisfies Prisma.ChangeInclude;

type ListRow = Prisma.ChangeGetPayload<{ include: typeof listInclude }>;
type DetailRow = Prisma.ChangeGetPayload<{ include: typeof detailInclude }>;

function stageInfo(steps: ListRow["steps"]): CurrentStage {
  const p = pendingStep(steps);
  return p ? { role: p.role, label: ROLE_LABELS[p.role], index: p.order + 1, total: steps.length } : null;
}

export function toListItem(c: ListRow | DetailRow): ChangeListItem {
  const { score, risk } = calcRisk(c.impact as Level, c.likelihood as Level);
  return {
    id: c.id, ref: c.ref, title: c.title, status: c.status, tier: c.tier, risk, score,
    type: c.type, department: c.department,
    requester: { id: c.requester.id, name: c.requester.name },
    implementer: c.implementer,
    plannedDate: c.plannedDate ? isoDate(c.plannedDate) : null,
    window: c.window,
    createdAt: iso(c.createdAt),
    currentStage: stageInfo(c.steps),
  };
}

export function toDetail(c: DetailRow, user: Actor): Omit<ChangeDetail, "activity"> {
  return {
    ...toListItem(c),
    requester: c.requester,
    summary: c.summary, reason: c.reason, emergency: c.emergency, impact: c.impact, likelihood: c.likelihood,
    customerFacing: c.customerFacing, regulatory: c.regulatory, personalData: c.personalData,
    systems: c.systems as string[],
    testPlan: c.testPlan, rollbackPlan: c.rollbackPlan,
    updatedAt: iso(c.updatedAt), submittedAt: isoOrNull(c.submittedAt),
    steps: c.steps.map((s) => ({
      id: s.id, order: s.order, role: s.role, roleLabel: ROLE_LABELS[s.role], status: s.status,
      decidedBy: s.decidedBy, decidedAt: isoOrNull(s.decidedAt), comment: s.comment, overridden: s.overridden,
    })),
    tasks: c.tasks.map((t) => ({ id: t.id, order: t.order, label: t.label, done: t.done, doneAt: isoOrNull(t.doneAt), doneBy: t.doneBy })),
    attachments: c.attachments.map((a) => ({ id: a.id, fileName: a.fileName, sizeBytes: a.sizeBytes, uploadedAt: iso(a.uploadedAt) })),
    pir: c.pir && { outcome: c.pir.outcome, notes: c.pir.notes, reviewedBy: c.pir.reviewedBy, reviewedAt: iso(c.pir.reviewedAt) },
    /** What the current user may do. The UI shows buttons from this; the API enforces it again. */
    actions: allowedActions(c, user),
  };
}
