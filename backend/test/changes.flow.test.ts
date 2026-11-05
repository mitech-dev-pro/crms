// Integration tests: real HTTP requests (Supertest) through the real app and the
// changehub_test database, signed in as the seeded demo users.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/db";

const app = createApp();
type Agent = ReturnType<typeof request.agent>;

/** A signed-in browser-like client: it keeps the session cookie between requests. */
async function signIn(handle: string): Promise<Agent> {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email: `${handle}@milife.com.gh`, password: "demo-password" }).expect(200);
  return agent;
}

let ama: Agent, kwame: Agent, efua: Agent, yaw: Agent, kojo: Agent, akosua: Agent, nana: Agent, martin: Agent;
let amaId: string, kojoId: string;
let dept: Record<string, string>, type: Record<string, string>;

beforeAll(async () => {
  const handles = ["ama.mensah", "kwame.boateng", "efua.asante", "yaw.owusu", "kojo.frimpong", "akosua.darko", "nana.agyeman", "martin.amudzi"] as const;
  const agents = await Promise.all(handles.map(signIn));
  [ama, kwame, efua, yaw, kojo, akosua, nana, martin] = agents as [Agent, Agent, Agent, Agent, Agent, Agent, Agent, Agent];
  amaId = (await ama.get("/api/auth/me")).body.id;
  const meta = (await ama.get("/api/meta").expect(200)).body;
  dept = Object.fromEntries(meta.departments.map((d: { name: string; id: string }) => [d.name, d.id]));
  type = Object.fromEntries(meta.changeTypes.map((t: { label: string; id: string }) => [t.label, t.id]));
  kojoId = meta.implementers.find((i: { name: string }) => i.name === "Kojo Frimpong").id;
});

afterAll(() => prisma.$disconnect());

/** A complete, valid wizard submission. Medium risk, Claims, outside any freeze. */
const changeBody = (over: Record<string, unknown> = {}) => ({
  typeId: type["IT / system"],
  departmentId: dept["Claims"],
  emergency: false,
  title: `Test change ${Math.random().toString(36).slice(2, 8)}`,
  summary: "Add a new payout channel.",
  reason: "Faster settlement.",
  systems: ["Claims portal"],
  impact: 2,
  likelihood: 2,
  customerFacing: true,
  regulatory: false,
  personalData: false,
  plannedDate: "2026-11-20",
  window: "20:00–22:00",
  implementerId: kojoId,
  testPlan: "UAT in staging",
  rollbackPlan: "Disable the feature flag",
  attest: true,
  submit: true,
  ...over,
});

const roles = (c: { steps: { role: string }[] }) => c.steps.map((s) => s.role);
const decide = (who: Agent, ref: string, kind: string, comment?: string) =>
  who.post(`/api/changes/${ref}/decision`).send({ kind, comment });

describe("full lifecycle: submit → 3 approvals → implement → review → closed", () => {
  it("runs end to end with every rule enforced along the way", async () => {
    // Requester submits: the server works out tier and route itself.
    const created = await ama.post("/api/changes").send(changeBody()).expect(201);
    const c = created.body;
    expect(c.ref).toMatch(/^CHG-\d{4}-\d{4}$/);
    expect(c.status).toBe("PendingApproval");
    expect(c.tier).toBe("Medium");
    expect(roles(c)).toEqual(["lineManager", "deptHead", "changeManager"]);
    expect(c.steps.map((s: { status: string }) => s.status)).toEqual(["pending", "waiting", "waiting"]);

    // It is in the Line Manager's inbox, not the Department Head's.
    const inbox = (a: Agent) => a.get("/api/approvals/inbox").expect(200).then((r) => r.body.items.map((i: { ref: string }) => i.ref));
    expect(await inbox(kwame)).toContain(c.ref);
    expect(await inbox(efua)).not.toContain(c.ref);

    // Stage-bound: the Department Head can't act before the Line Manager.
    const early = await decide(efua, c.ref, "approve").expect(403);
    expect(early.body.error.message).toContain("Line Manager");

    await decide(kwame, c.ref, "approve", "Looks good").expect(200);
    await decide(efua, c.ref, "approve").expect(200);
    const approved = (await decide(yaw, c.ref, "approve").expect(200)).body;
    expect(approved.status).toBe("Scheduled"); // has a planned date
    expect(approved.steps.every((s: { status: string }) => s.status === "approved")).toBe(true);
    expect(approved.steps[0].comment).toBe("Looks good");

    // Deciding again is refused: nothing is pending any more.
    await decide(yaw, c.ref, "approve").expect(409);

    // Only the assigned implementer (or the Change Manager) can start.
    await ama.post(`/api/changes/${c.ref}/start`).expect(403);
    const started = (await kojo.post(`/api/changes/${c.ref}/start`).expect(200)).body;
    expect(started.status).toBe("InProgress");
    expect(started.actions.updateTasks).toBe(true);

    // Can't finish with open checklist items.
    const notYet = await kojo.post(`/api/changes/${c.ref}/implemented`).expect(409);
    expect(notYet.body.error.message).toMatch(/checklist/i);

    for (const t of started.tasks) await kojo.patch(`/api/changes/${c.ref}/tasks/${t.id}`).send({ done: true }).expect(200);
    const implemented = (await kojo.post(`/api/changes/${c.ref}/implemented`).expect(200)).body;
    expect(implemented.status).toBe("Implemented");

    // Only the Change Manager closes it with a post-implementation review.
    await ama.post(`/api/changes/${c.ref}/pir`).send({ outcome: "Successful", notes: "ok" }).expect(403);
    await yaw.post(`/api/changes/${c.ref}/pir`).send({ outcome: "Successful" }).expect(400); // notes required
    const closed = (await yaw.post(`/api/changes/${c.ref}/pir`).send({ outcome: "Successful", notes: "No issues." }).expect(200)).body;
    expect(closed.status).toBe("Closed");
    expect(closed.pir.outcome).toBe("Successful");

    // Every step is in the audit trail, attached to the change.
    const actions = closed.activity.map((a: { action: string }) => a.action).reverse();
    expect(actions).toEqual(expect.arrayContaining([
      "Saved draft", "Submitted change request",
      "Approved at Line Manager stage", "Approved at Department Head stage", "Approved at Change Manager stage",
      "Started implementation", "Marked as implemented", "Completed post-implementation review & closed",
    ]));
    expect(actions.filter((a: string) => a.startsWith("Completed checklist item"))).toHaveLength(started.tasks.length);
  });
});

describe("segregation of duties", () => {
  it("the requester cannot approve their own change, even holding the stage role", async () => {
    // IT's Low route is Change Manager only, and Yaw is the Change Manager.
    const c = (await yaw.post("/api/changes").send(changeBody({ departmentId: dept["IT"], impact: 1, likelihood: 1 })).expect(201)).body;
    expect(roles(c)).toEqual(["changeManager"]);
    expect(c.actions.sodBlocked).toBe(true);
    expect(c.actions.decide).toBe(false);

    const res = await decide(yaw, c.ref, "approve").expect(403);
    expect(res.body.error.message).toBe("You cannot approve a change you raised");
  });
});

describe("reject and return", () => {
  it("rejecting needs a comment and skips the remaining stages", async () => {
    const c = (await ama.post("/api/changes").send(changeBody()).expect(201)).body;
    const noComment = await decide(kwame, c.ref, "reject").expect(400);
    expect(noComment.body.error.fields.comment).toBe("A comment is required");

    const rejected = (await decide(kwame, c.ref, "reject", "Not enough testing evidence").expect(200)).body;
    expect(rejected.status).toBe("Rejected");
    expect(rejected.steps.map((s: { status: string }) => s.status)).toEqual(["rejected", "skipped", "skipped"]);
  });

  it("a returned change can be edited by the requester and resubmitted with a fresh route", async () => {
    const c = (await ama.post("/api/changes").send(changeBody()).expect(201)).body;
    await decide(kwame, c.ref, "approve").expect(200);
    const returned = (await decide(efua, c.ref, "return", "Please add a rollback test").expect(200)).body;
    expect(returned.status).toBe("ReturnedForRework");

    // Only the requester may edit it now.
    await kwame.patch(`/api/changes/${c.ref}`).send({ summary: "x" }).expect(403);
    const amaView = (await ama.get(`/api/changes/${c.ref}`).expect(200)).body;
    expect(amaView.actions.edit).toBe(true);

    await ama.patch(`/api/changes/${c.ref}`).send({ testPlan: "UAT + rollback rehearsal" }).expect(200);
    await ama.post(`/api/changes/${c.ref}/submit`).send({}).expect(400); // attest required
    const resubmitted = (await ama.post(`/api/changes/${c.ref}/submit`).send({ attest: true }).expect(200)).body;
    expect(resubmitted.status).toBe("PendingApproval");
    expect(resubmitted.testPlan).toBe("UAT + rollback rehearsal");
    expect(resubmitted.steps.map((s: { status: string }) => s.status)).toEqual(["pending", "waiting", "waiting"]);
    expect(resubmitted.activity.map((a: { action: string }) => a.action)).toContain("Resubmitted change request");
  });
});

describe("routing", () => {
  it("adds an Executive stage for a change dated inside a freeze", async () => {
    const preview = (await ama.get("/api/changes/route-preview").query({ departmentId: dept["Claims"], impact: 2, likelihood: 2, plannedDate: "2026-11-28" }).expect(200)).body;
    expect(preview.route.map((r: { role: string }) => r.role)).toEqual(["lineManager", "deptHead", "changeManager", "exec"]);
    expect(preview.freeze.name).toBe("Month-end financial close");

    const c = (await ama.post("/api/changes").send(changeBody({ plannedDate: "2026-11-28" })).expect(201)).body;
    expect(roles(c)).toEqual(["lineManager", "deptHead", "changeManager", "exec"]);
  });

  it("routes emergencies to Change Manager → CAB, with no freeze stage", async () => {
    const c = (await ama.post("/api/changes").send(changeBody({ emergency: true, plannedDate: "2026-11-28" })).expect(201)).body;
    expect(c.tier).toBe("Emergency");
    expect(roles(c)).toEqual(["changeManager", "cab"]);
  });

  it("uses Finance's own Medium route (adds Risk & Compliance)", async () => {
    const c = (await martin.post("/api/changes").send(changeBody({ departmentId: dept["Finance"] })).expect(201)).body;
    expect(roles(c)).toEqual(["lineManager", "deptHead", "risk", "changeManager"]);
    // Risk can't act until the earlier stages are done.
    await decide(nana, c.ref, "approve").expect(403);
  });

  it("ignores a tier sent by the client", async () => {
    const c = (await ama.post("/api/changes").send(changeBody({ impact: 1, likelihood: 1, tier: "High" })).expect(201)).body;
    expect(c.tier).toBe("Low");
  });
});

describe("drafts and visibility", () => {
  it("saves a minimal draft, keeps it private, and validates it fully on submit", async () => {
    const d = (await ama.post("/api/changes").send({ typeId: type["Product"], departmentId: dept["Claims"] }).expect(201)).body;
    expect(d.status).toBe("Draft");
    expect(d.title).toBe("Untitled change");
    expect(d.steps).toEqual([]); // the route is only built on submit

    await yaw.get(`/api/changes/${d.ref}`).expect(404); // other people's drafts are invisible

    const incomplete = await ama.post(`/api/changes/${d.ref}/submit`).send({ attest: true }).expect(400);
    expect(incomplete.body.error.fields).toMatchObject({ summary: "Summary is required", rollbackPlan: "Rollback plan is required" });
  });

  it("a requester only ever sees their own changes", async () => {
    const list = (await ama.get("/api/changes").query({ pageSize: 100 }).expect(200)).body;
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every((c: { requester: { id: string } }) => c.requester.id === amaId)).toBe(true);
    expect(list.counts.Draft).toBeGreaterThan(0);
  });

  it("filters and paginates the list", async () => {
    const page = (await yaw.get("/api/changes").query({ status: "Closed", pageSize: 5, page: 2, sort: "ref" }).expect(200)).body;
    expect(page.items).toHaveLength(5);
    expect(page.items.every((c: { status: string }) => c.status === "Closed")).toBe(true);
    expect(page.total).toBe(page.counts.Closed);
  });
});

describe("permissions", () => {
  it("roles without the New request screen can't create changes", async () => {
    await kojo.post("/api/changes").send(changeBody()).expect(403); // implementer
    await akosua.post("/api/changes").send(changeBody()).expect(403); // CAB
  });

  it("nothing works signed out", async () => {
    await request(app).get("/api/changes").expect(401);
    await request(app).post("/api/changes").send(changeBody()).expect(401);
  });

  it("rejects unknown ids in the body", async () => {
    const res = await ama.post("/api/changes").send(changeBody({ departmentId: "nope" })).expect(400);
    expect(res.body.error.code).toBe("INVALID_REFERENCE");
  });
});
