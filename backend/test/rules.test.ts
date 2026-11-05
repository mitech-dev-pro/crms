// Unit tests: pure functions only, no database. These pin down the business rules.
import { buildRoute, calcRisk, tierFor } from "@crms/shared";
import { describe, expect, it } from "vitest";
import { allowedActions, applyDecision, buildSteps, type ChangeFacts } from "../src/modules/changes/rules";

describe("risk scoring", () => {
  it("bands impact × likelihood into Low ≤ 2, Medium ≤ 4, High ≥ 6", () => {
    expect(calcRisk(1, 1)).toEqual({ score: 1, risk: "Low" });
    expect(calcRisk(1, 2)).toEqual({ score: 2, risk: "Low" });
    expect(calcRisk(1, 3)).toEqual({ score: 3, risk: "Medium" });
    expect(calcRisk(2, 2)).toEqual({ score: 4, risk: "Medium" });
    expect(calcRisk(3, 2)).toEqual({ score: 6, risk: "High" });
    expect(calcRisk(3, 3)).toEqual({ score: 9, risk: "High" });
  });

  it("makes the tier Emergency whatever the score", () => {
    expect(tierFor(1, 1, true)).toBe("Emergency");
    expect(tierFor(3, 3, false)).toBe("High");
  });
});

describe("approval routes", () => {
  const freezes = [{ name: "Month-end", from: "2026-11-27", to: "2026-12-02" }];

  it("uses the default route when the department has no override", () => {
    expect(buildRoute({ tier: "Medium", freezes: [] }).route).toEqual(["lineManager", "deptHead", "changeManager"]);
  });

  it("prefers the department override", () => {
    expect(buildRoute({ tier: "Low", deptOverride: { Low: ["changeManager"] }, freezes: [] }).route).toEqual(["changeManager"]);
  });

  it("adds an Executive stage inside a freeze window, including both edge days", () => {
    for (const d of ["2026-11-27", "2026-12-02"]) {
      const r = buildRoute({ tier: "Medium", plannedDate: d, freezes });
      expect(r.route.at(-1)).toBe("exec");
      expect(r.freeze?.name).toBe("Month-end");
    }
    expect(buildRoute({ tier: "Medium", plannedDate: "2026-12-03", freezes }).route).not.toContain("exec");
  });

  it("never adds exec to emergencies, and never adds it twice", () => {
    expect(buildRoute({ tier: "Emergency", plannedDate: "2026-11-28", freezes }).route).toEqual(["changeManager", "cab"]);
    const withExec = buildRoute({ tier: "High", deptOverride: { High: ["lineManager", "exec"] }, plannedDate: "2026-11-28", freezes });
    expect(withExec.route).toEqual(["lineManager", "exec"]);
  });
});

// A change with three stages; tweak per test.
const facts = (over: Partial<ChangeFacts> = {}): ChangeFacts => ({
  status: "PendingApproval",
  requesterId: "ama",
  requester: { role: "requester" },
  implementerId: "kojo",
  plannedDate: new Date("2026-11-20"),
  steps: buildSteps(["lineManager", "deptHead", "changeManager"]).map((s, i) => ({ ...s, id: `s${i}` })),
  tasks: [{ done: false }, { done: false }],
  ...over,
});

describe("decisions", () => {
  it("approving moves the next stage to pending", () => {
    const r = applyDecision(facts(), "approve");
    expect(r.updates).toEqual([{ id: "s0", status: "approved" }, { id: "s1", status: "pending" }]);
    expect(r.status).toBe("PendingApproval");
  });

  it("approving the last stage schedules a dated change, or approves an undated one", () => {
    const last = (plannedDate: Date | null) =>
      facts({
        plannedDate,
        steps: [
          { id: "s0", order: 0, role: "lineManager", status: "approved" },
          { id: "s1", order: 1, role: "changeManager", status: "pending" },
        ],
      });
    expect(applyDecision(last(new Date()), "approve").status).toBe("Scheduled");
    expect(applyDecision(last(null), "approve").status).toBe("Approved");
  });

  it("rejecting skips every stage still waiting", () => {
    const r = applyDecision(facts(), "reject");
    expect(r.status).toBe("Rejected");
    expect(r.updates).toEqual([
      { id: "s0", status: "rejected" },
      { id: "s1", status: "skipped" },
      { id: "s2", status: "skipped" },
    ]);
  });

  it("returning sends the change back for rework", () => {
    const r = applyDecision(facts(), "return");
    expect(r.status).toBe("ReturnedForRework");
    expect(r.updates).toEqual([{ id: "s0", status: "returned" }]);
  });
});

describe("who may do what", () => {
  it("only the role at the current stage may decide", () => {
    expect(allowedActions(facts(), { id: "kwame", role: "lineManager" }).decide).toBe(true);
    expect(allowedActions(facts(), { id: "efua", role: "deptHead" }).decide).toBe(false);
  });

  it("segregation of duties: you cannot decide on a change you raised", () => {
    const a = allowedActions(facts({ requesterId: "kwame" }), { id: "kwame", role: "lineManager" });
    expect(a.decide).toBe(false);
    expect(a.sodBlocked).toBe(true);
  });

  it("only the assigned implementer or the Change Manager can start", () => {
    const scheduled = facts({ status: "Scheduled" });
    expect(allowedActions(scheduled, { id: "kojo", role: "implementer" }).start).toBe(true);
    expect(allowedActions(scheduled, { id: "yaw", role: "changeManager" }).start).toBe(true);
    expect(allowedActions(scheduled, { id: "adjoa", role: "implementer" }).start).toBe(false);
  });

  it("marking implemented needs every checklist item done", () => {
    const kojo = { id: "kojo", role: "implementer" } as const;
    expect(allowedActions(facts({ status: "InProgress" }), kojo).markImplemented).toBe(false);
    expect(allowedActions(facts({ status: "InProgress", tasks: [{ done: true }, { done: true }] }), kojo).markImplemented).toBe(true);
    expect(allowedActions(facts({ status: "InProgress", tasks: [] }), kojo).markImplemented).toBe(false);
  });

  describe("super admin break-glass override", () => {
    // Yaw (Change Manager) raised a change whose only stage is Change Manager.
    const blocked = facts({
      requesterId: "yaw",
      requester: { role: "changeManager" },
      steps: [{ id: "s0", order: 0, role: "changeManager", status: "pending" }],
    });
    const superAdmin = { id: "sa", role: "superAdmin" } as const;

    it("is allowed only when the requester holds the pending stage's role", () => {
      expect(allowedActions(blocked, superAdmin).override).toBe(true);
      expect(allowedActions(facts(), superAdmin).override).toBe(false); // normal change: no conflict
    });

    it("is never allowed on the super admin's own change", () => {
      expect(allowedActions({ ...blocked, requesterId: "sa" }, superAdmin).override).toBe(false);
    });

    it("is never allowed once the change has left approval", () => {
      expect(allowedActions({ ...blocked, status: "Scheduled" }, superAdmin).override).toBe(false);
    });

    it("is for super admins only, and a deputy uses the normal decision instead", () => {
      const deputy = { id: "deputy", role: "changeManager" } as const;
      expect(allowedActions(blocked, deputy).override).toBe(false);
      expect(allowedActions(blocked, deputy).decide).toBe(true);
      expect(allowedActions(blocked, { id: "selorm", role: "admin" }).override).toBe(false);
    });
  });

  it("only the requester can edit, and only a draft or returned change", () => {
    expect(allowedActions(facts({ status: "Draft" }), { id: "ama", role: "requester" }).edit).toBe(true);
    expect(allowedActions(facts({ status: "ReturnedForRework" }), { id: "ama", role: "requester" }).edit).toBe(true);
    expect(allowedActions(facts({ status: "PendingApproval" }), { id: "ama", role: "requester" }).edit).toBe(false);
    expect(allowedActions(facts({ status: "Draft" }), { id: "yaw", role: "changeManager" }).edit).toBe(false);
  });
});
