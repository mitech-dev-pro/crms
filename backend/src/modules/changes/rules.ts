// The change workflow as pure functions: no database, no HTTP.
// Given a change and a user, these decide what is allowed and what happens next.
// The service loads data, calls these, and saves the result.
import type { ChangeStatus, Role, StepStatus } from "@crms/shared";

export type StepFacts = { id: string; order: number; role: Role; status: StepStatus };

export type ChangeFacts = {
  status: ChangeStatus;
  requesterId: string;
  requester: { role: Role };
  implementerId: string | null;
  plannedDate: Date | null;
  steps: StepFacts[];
  tasks: { done: boolean }[];
};

export type Actor = { id: string; role: Role };

export type DecisionKind = "approve" | "reject" | "return";

export const pendingStep = (steps: StepFacts[]) => steps.find((s) => s.status === "pending");

const editable: ChangeStatus[] = ["Draft", "ReturnedForRework"];
const startable: ChangeStatus[] = ["Scheduled", "Approved"];

/** The Change Manager, or the implementer assigned to this change. */
export const isImplementerOf = (c: Pick<ChangeFacts, "implementerId">, u: Actor) =>
  u.role === "changeManager" || (u.role === "implementer" && c.implementerId === u.id);

/**
 * Everything the user may do with this change right now.
 * The API enforces each flag, and sends them to the UI so it can show the right buttons.
 */
export function allowedActions(c: ChangeFacts, u: Actor) {
  const pending = pendingStep(c.steps);
  const isRequester = c.requesterId === u.id;
  const atMyStage = c.status === "PendingApproval" && pending?.role === u.role;
  const isImplementer = isImplementerOf(c, u);
  const allTasksDone = c.tasks.length > 0 && c.tasks.every((t) => t.done);
  // The requester holds the role of the stage they are waiting at, so segregation
  // of duties stops them, and possibly nobody else holds that role.
  const stageConflict = c.status === "PendingApproval" && !!pending && c.requester.role === pending.role;

  return {
    edit: isRequester && editable.includes(c.status),
    submit: isRequester && editable.includes(c.status),
    /** Approve, reject or return: only the role at the current stage, and never the requester. */
    decide: atMyStage && !isRequester,
    /** True when it is your stage but you raised the change (segregation of duties). */
    sodBlocked: atMyStage && isRequester,
    /**
     * Break-glass: a super admin may decide a stage the requester is blocked from,
     * with a mandatory reason. Never on a change they raised themselves.
     * Normal path for this case: a deputy holding the same role approves it.
     */
    override: u.role === "superAdmin" && stageConflict && !isRequester,
    start: isImplementer && startable.includes(c.status),
    updateTasks: isImplementer && c.status === "InProgress",
    markImplemented: isImplementer && c.status === "InProgress" && allTasksDone,
    review: u.role === "changeManager" && c.status === "Implemented",
    /** The requester can add evidence until approval is complete… */
    attach: isRequester && [...editable, "PendingApproval"].includes(c.status),
    /** …but only remove files while the request is still theirs to edit. */
    removeAttachment: isRequester && editable.includes(c.status),
  };
}
export type AllowedActions = ReturnType<typeof allowedActions>;

/** Steps for a freshly submitted change: the first stage is pending, the rest wait. */
export function buildSteps(route: readonly Role[]) {
  return route.map((role, order) => ({ order, role, status: (order === 0 ? "pending" : "waiting") as StepStatus }));
}

/**
 * Applies a decision at the pending stage.
 * Returns the steps whose status changes and the change's new status.
 */
export function applyDecision(c: Pick<ChangeFacts, "steps" | "plannedDate">, kind: DecisionKind) {
  const steps = [...c.steps].sort((a, b) => a.order - b.order);
  const current = pendingStep(steps);
  if (!current) throw new Error("No pending stage to decide");

  const updates: { id: string; status: StepStatus }[] = [];
  let status: ChangeStatus;

  if (kind === "approve") {
    updates.push({ id: current.id, status: "approved" });
    const next = steps.find((s) => s.status === "waiting");
    if (next) {
      updates.push({ id: next.id, status: "pending" });
      status = "PendingApproval";
    } else {
      // Last stage approved: scheduled if it has a date, otherwise just approved.
      status = c.plannedDate ? "Scheduled" : "Approved";
    }
  } else if (kind === "reject") {
    updates.push({ id: current.id, status: "rejected" });
    for (const s of steps) if (s.status === "waiting") updates.push({ id: s.id, status: "skipped" });
    status = "Rejected";
  } else {
    updates.push({ id: current.id, status: "returned" });
    status = "ReturnedForRework";
  }

  return { current, updates, status };
}
