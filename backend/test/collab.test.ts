// Email notifications, password reset, reminders and escalation, stand-ins, and the discussion.
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db";
import { flushMail, recentMail, type Mail } from "../src/lib/mail";
import { addWorkingDays, workingDaysBetween } from "@crms/shared";
import { runReminders } from "../src/services/reminders";
import { app, signIn, type Agent } from "./helpers";

const at = (handle: string) => `${handle}@milifeghana.com`;
let ama: Agent, kwame: Agent, yaw: Agent, efua: Agent, victor: Agent;
let dept: Record<string, string>, type: Record<string, string>, kojoId: string;
const userId = async (handle: string) => (await prisma.user.findUniqueOrThrow({ where: { email: at(handle) } })).id;

beforeAll(async () => {
  [ama, kwame, yaw, efua, victor] = (await Promise.all(["ama.mensah", "kwame.boateng", "yaw.owusu", "efua.asante", "victor.aggrey-fynn"].map(signIn))) as Agent[] as [Agent, Agent, Agent, Agent, Agent];
  const meta = (await ama.get("/api/meta").expect(200)).body;
  dept = Object.fromEntries(meta.departments.map((d: { name: string; id: string }) => [d.name, d.id]));
  type = Object.fromEntries(meta.changeTypes.map((t: { label: string; id: string }) => [t.label, t.id]));
  kojoId = meta.implementers.find((i: { name: string }) => i.name === "Kojo Frimpong").id;
});
afterAll(() => prisma.$disconnect());
beforeEach(() => void (recentMail.length = 0));

/** Mail handed to the mailer since the test started, after background work has finished. */
const mail = async () => (await flushMail(), [...recentMail]);
const to = (m: Mail[], subject: RegExp) => m.filter((x) => subject.test(x.subject)).flatMap((x) => x.to);

/** Low risk in Claims: a one-stage route (Line Manager). */
const lowRiskChange = (over: Record<string, unknown> = {}) => ({
  typeId: type["IT / system"], departmentId: dept["Claims"], emergency: false,
  title: `Collab test ${Math.random().toString(36).slice(2, 8)}`, summary: "A small change.", reason: "Testing.", systems: ["Claims portal"],
  impact: 1, likelihood: 1, customerFacing: false, regulatory: false, personalData: false,
  plannedDate: "2026-11-20", window: "20:00–22:00", implementerId: kojoId, testPlan: "Check it", rollbackPlan: "Undo it",
  attest: true, submit: true, ...over,
});

describe("email notifications", () => {
  it("tells the stage's approvers, then the requester and implementer when it's approved", async () => {
    const c = (await ama.post("/api/changes").send(lowRiskChange()).expect(201)).body;
    let m = await mail();
    const approvers = to(m, new RegExp(`^Approval needed: ${c.ref}`));
    expect(approvers).toContain(at("kwame.boateng"));
    expect(approvers).not.toContain(at("ama.mensah")); // never the requester
    expect(m.find((x) => x.subject.startsWith("Approval needed"))!.html).toContain(`/changes/${c.ref}`);

    recentMail.length = 0;
    await kwame.post(`/api/changes/${c.ref}/decision`).send({ kind: "approve" }).expect(200);
    m = await mail();
    expect(to(m, /is approved and scheduled/)).toEqual([at("ama.mensah")]);
    expect(to(m, /^Ready to implement/)).toEqual([at("kojo.frimpong")]);
  });

  it("escapes what users typed in the HTML version", async () => {
    await ama.post("/api/changes").send(lowRiskChange({ title: "Fix <script>alert(1)</script> bug" })).expect(201);
    const html = (await mail()).find((x) => x.subject.startsWith("Approval needed"))!.html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("forgot password", () => {
  const linkIn = (m: Mail[]) => m.find((x) => x.subject === "Reset your ChangeHub password")!.text.match(/token=([\w-]+)/)![1]!;

  it("gives the same answer for any email, and only emails active accounts", async () => {
    const known = await request(app).post("/api/auth/forgot-password").send({ email: at("efua.asante") }).expect(202);
    const unknown = await request(app).post("/api/auth/forgot-password").send({ email: at("nobody.here") }).expect(202);
    const disabled = await request(app).post("/api/auth/forgot-password").send({ email: at("kafui.philomena") }).expect(202);
    expect(unknown.body).toEqual(known.body);
    expect(disabled.body).toEqual(known.body);
    const m = await mail();
    expect(to(m, /Reset your ChangeHub password/)).toEqual([at("efua.asante")]);
  });

  it("resets the password once with the emailed link, and signs out every session", async () => {
    const before = await signIn("fiifi.sam");
    await request(app).post("/api/auth/forgot-password").send({ email: at("fiifi.sam") }).expect(202);
    const token = linkIn(await mail());

    await request(app).post("/api/auth/reset-password").send({ token, newPassword: "short" }).expect(400);
    await request(app).post("/api/auth/reset-password").send({ token, newPassword: "BrandNew2026" }).expect(204);
    await before.get("/api/auth/me").expect(401); // old session ended
    await request(app).post("/api/auth/login").send({ email: at("fiifi.sam"), password: "BrandNew2026" }).expect(200);

    const again = await request(app).post("/api/auth/reset-password").send({ token, newPassword: "Another2026x" }).expect(400);
    expect(again.body.error.code).toBe("INVALID_RESET_LINK");
    expect(to(await mail(), /password was changed/)).toContain(at("fiifi.sam"));
  });

  it("refuses an expired link, and a new request cancels the old link", async () => {
    await request(app).post("/api/auth/forgot-password").send({ email: at("michael.obeng") }).expect(202);
    const first = linkIn(await mail());
    recentMail.length = 0;
    await request(app).post("/api/auth/forgot-password").send({ email: at("michael.obeng") }).expect(202);
    const second = linkIn(await mail());
    await request(app).post("/api/auth/reset-password").send({ token: first, newPassword: "BrandNew2026" }).expect(400);

    const id = await userId("michael.obeng");
    await prisma.passwordResetToken.updateMany({ where: { userId: id, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await request(app).post("/api/auth/reset-password").send({ token: second, newPassword: "BrandNew2026" }).expect(400);
  });
});

describe("reminders and escalation", () => {
  it("counts working days, skipping weekends", () => {
    const fri = new Date("2026-11-06T15:00:00Z");
    expect(addWorkingDays(fri, 2).toISOString()).toBe("2026-11-10T15:00:00.000Z"); // Fri + 2 → Tue
    expect(addWorkingDays(new Date("2026-11-07T11:00:00Z"), 1).toISOString()).toBe("2026-11-10T00:00:00.000Z"); // Sat counts from Mon
    expect(workingDaysBetween(fri, new Date("2026-11-09T16:00:00Z"))).toBe(1);
  });

  it("reminds after 2 working days, escalates after 4, and never repeats", async () => {
    const c = (await ama.post("/api/changes").send(lowRiskChange()).expect(201)).body;
    const step = await prisma.approvalStep.findFirstOrThrow({ where: { change: { ref: c.ref }, status: "pending" } });
    // Pretend it started waiting on Monday 2 Nov 2026, 09:00.
    await prisma.approvalStep.update({ where: { id: step.id }, data: { pendingSince: new Date("2026-11-02T09:00:00Z") } });
    recentMail.length = 0;

    await runReminders(new Date("2026-11-04T08:00:00Z")); // Wednesday, just before due
    expect(to(await mail(), new RegExp(`Reminder: ${c.ref}`))).toEqual([]);

    await runReminders(new Date("2026-11-04T10:00:00Z")); // due
    let m = await mail();
    expect(to(m, new RegExp(`Reminder: ${c.ref}`))).toContain(at("kwame.boateng"));
    expect(to(m, new RegExp(`Escalation: ${c.ref}`))).toEqual([]);

    recentMail.length = 0;
    await runReminders(new Date("2026-11-05T10:00:00Z"));
    expect(to(await mail(), new RegExp(c.ref))).toEqual([]); // reminded only once

    await runReminders(new Date("2026-11-06T10:00:00Z")); // Friday: 4 working days
    m = await mail();
    expect(to(m, new RegExp(`Escalation: ${c.ref}`))).toEqual(expect.arrayContaining([at("yaw.owusu"), at("deputy.change.manager")]));

    const audit = await prisma.auditLog.findMany({ where: { ref: c.ref, userName: "ChangeHub (automatic)" }, orderBy: { at: "asc" } });
    expect(audit.map((a) => a.action)).toEqual([
      "Reminder sent: waiting 2 working days at Line Manager stage",
      "Escalated to Change Manager: waiting 4 working days at Line Manager stage",
    ]);

    // The detail shows when the decision is due.
    const detail = (await kwame.get(`/api/changes/${c.ref}`).expect(200)).body;
    expect(detail.currentStage.dueAt).toBe("2026-11-04T09:00:00.000Z");
  });
});

describe("stand-ins", () => {
  it("lets a stand-in decide the absent approver's stage, recorded on their behalf", async () => {
    // Efua (Head of Claims) is away; Victor (a Line Manager) covers her Department Head stages.
    const victorId = await userId("victor.aggrey-fynn");
    const created = await efua.post("/api/stand-ins").send({ toUserId: victorId, startsOn: "2026-11-01", endsOn: "2026-12-31", reason: "Annual leave" }).expect(201);
    expect(created.body).toMatchObject({ from: { name: "Efua Asante", role: "deptHead" }, to: { name: "Victor Aggrey-fynn" }, state: "active" });
    expect(to(await mail(), /standing in for Efua Asante/)).toEqual([at("victor.aggrey-fynn")]);

    // A Medium Claims change: Line Manager, then Department Head.
    const c = (await ama.post("/api/changes").send(lowRiskChange({ impact: 2, likelihood: 2 })).expect(201)).body;
    await kwame.post(`/api/changes/${c.ref}/decision`).send({ kind: "approve" }).expect(200);
    const m = await mail();
    expect(to(m, new RegExp(`^Approval needed: ${c.ref}`))).toContain(at("victor.aggrey-fynn")); // stand-ins get the email

    // Re-sign in: stand-ins are read when the request is authenticated.
    const v = await signIn("victor.aggrey-fynn");
    const inbox = (await v.get("/api/approvals/inbox").expect(200)).body.items.map((x: { ref: string }) => x.ref);
    expect(inbox).toContain(c.ref);
    const before = (await v.get(`/api/changes/${c.ref}`).expect(200)).body;
    expect(before.actions).toMatchObject({ decide: true, standInFor: "Efua Asante" });

    const after = (await v.post(`/api/changes/${c.ref}/decision`).send({ kind: "approve", comment: "Covering for Efua" }).expect(200)).body;
    const step = after.steps.find((s: { role: string }) => s.role === "deptHead");
    expect(step).toMatchObject({ status: "approved", decidedBy: { name: "Victor Aggrey-fynn" }, onBehalfOf: { name: "Efua Asante" } });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { ref: c.ref, category: "decision", userName: "Victor Aggrey-fynn" } });
    expect(audit.action).toBe("Approved at Department Head stage (stand-in for Efua Asante)");
  });

  it("can't be used to approve the absent approver's own change, and can be ended early", async () => {
    // Efua raises a change; Victor covers Efua, but Efua's own change must not be decided "for" her.
    const mine = (await efua.get("/api/stand-ins").expect(200)).body.items.find((s: { state: string }) => s.state === "active");
    const c = (await efua.post("/api/changes").send(lowRiskChange({ impact: 2, likelihood: 2 })).expect(201)).body;
    await kwame.post(`/api/changes/${c.ref}/decision`).send({ kind: "approve" }).expect(200);
    const v = await signIn("victor.aggrey-fynn");
    const detail = (await v.get(`/api/changes/${c.ref}`).expect(200)).body;
    expect(detail.actions).toMatchObject({ decide: false, standInFor: null });
    await v.post(`/api/changes/${c.ref}/decision`).send({ kind: "approve" }).expect(403);

    await victor.delete(`/api/stand-ins/${mine.id}`).expect(403); // only the approver, the arranger or an admin
    await efua.delete(`/api/stand-ins/${mine.id}`).expect(204);
    const v2 = await signIn("victor.aggrey-fynn");
    expect((await v2.get("/api/auth/me").expect(200)).body.id).toBeTruthy();
    const items = (await efua.get("/api/stand-ins").expect(200)).body.items;
    expect(items.find((s: { id: string }) => s.id === mine.id).state).toBe("ended");
  });

  it("checks who may arrange what", async () => {
    const kwameId = await userId("kwame.boateng");
    const amaId = await userId("ama.mensah");
    const efuaId = await userId("efua.asante");
    // Requesters don't approve, so they can't have a stand-in, or be one.
    await ama.post("/api/stand-ins").send({ toUserId: kwameId, startsOn: "2026-12-01", endsOn: "2026-12-05" }).expect(400);
    const notApprover = await kwame.post("/api/stand-ins").send({ toUserId: amaId, startsOn: "2026-12-01", endsOn: "2026-12-05" }).expect(400);
    expect(notApprover.body.error.fields.toUserId).toMatch(/approves changes/);
    // Only managers arrange cover for someone else.
    await kwame.post("/api/stand-ins").send({ fromUserId: efuaId, toUserId: kwameId, startsOn: "2026-12-01", endsOn: "2026-12-05" }).expect(403);
    await yaw.post("/api/stand-ins").send({ fromUserId: kwameId, toUserId: efuaId, startsOn: "2026-12-01", endsOn: "2026-12-05" }).expect(201);
    // No overlapping cover for the same person.
    await kwame.post("/api/stand-ins").send({ toUserId: efuaId, startsOn: "2026-12-03", endsOn: "2026-12-10" }).expect(409);
  });
});

describe("discussion", () => {
  it("anyone who can see the change can comment; participants are emailed", async () => {
    const c = (await ama.post("/api/changes").send(lowRiskChange()).expect(201)).body;
    await kwame.post(`/api/changes/${c.ref}/comments`).send({ body: "   " }).expect(400);
    const after = (await kwame.post(`/api/changes/${c.ref}/comments`).send({ body: "Can we move this to Saturday?" }).expect(201)).body;
    expect(after.comments).toEqual([expect.objectContaining({ body: "Can we move this to Saturday?", author: expect.objectContaining({ name: "Kwame Boateng" }) })]);
    expect(to(await mail(), new RegExp(`New comment on ${c.ref}`))).toEqual([at("ama.mensah")]);

    recentMail.length = 0;
    await ama.post(`/api/changes/${c.ref}/comments`).send({ body: "Yes, Saturday works." }).expect(201);
    expect(to(await mail(), new RegExp(`New comment on ${c.ref}`))).toEqual([at("kwame.boateng")]); // the author isn't emailed
  });

  it("is hidden along with the change: another requester gets a 404", async () => {
    const draft = (await ama.post("/api/changes").send(lowRiskChange({ submit: false })).expect(201)).body;
    const other = await signIn("yaa.asantewaa");
    await other.post(`/api/changes/${draft.ref}/comments`).send({ body: "Hello" }).expect(404);
  });
});
