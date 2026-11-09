// Administration: departments, change types, users (invite, roles, reset, import), workflows.
// These tests only modify records they create, so other test files are unaffected.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db";
import { app, signIn, type Agent } from "./helpers";

let selorm: Agent, superAdmin: Agent, ama: Agent;
let testDept: { id: string; code: string };
beforeAll(async () => {
  [selorm, superAdmin, ama] = (await Promise.all(["selorm.dzidzienyo", "super.admin", "ama.mensah"].map(signIn))) as [Agent, Agent, Agent];
});
afterAll(() => prisma.$disconnect());

const login = (email: string, password: string) => request(app).post("/api/auth/login").send({ email, password });

describe("access", () => {
  it("is limited to System Admin and Super Admin", async () => {
    await ama.get("/api/admin/users").expect(403);
    await selorm.get("/api/admin/users").expect(200);
    await superAdmin.get("/api/admin/users").expect(200);
  });
});

describe("departments", () => {
  it("adds one, refuses duplicates and bad codes, and deactivates it", async () => {
    await selorm.post("/api/admin/departments").send({ code: "x", name: "Bad" }).expect(400);
    const list = (await selorm.post("/api/admin/departments").send({ code: "tst", name: "Testing Unit" }).expect(201)).body.items;
    const d = list.find((x: { code: string }) => x.code === "TST"); // code is upper-cased
    expect(d).toMatchObject({ name: "Testing Unit", active: true, userCount: 0, hasCustomRoute: false });
    testDept = d;

    const dup = await selorm.post("/api/admin/departments").send({ code: "TST", name: "Other" }).expect(409);
    expect(dup.body.error.code).toBe("DUPLICATE");

    await selorm.patch(`/api/admin/departments/${d.id}`).send({ active: false }).expect(200);
    const meta = (await ama.get("/api/meta").expect(200)).body;
    expect(meta.departments.some((x: { code: string }) => x.code === "TST")).toBe(false); // inactive: not offered in forms
    await selorm.patch(`/api/admin/departments/${d.id}`).send({ active: true }).expect(200);
  });
});

describe("change types", () => {
  it("adds and deactivates a type", async () => {
    const items = (await selorm.post("/api/admin/change-types").send({ label: "Data migration", description: "Moving data between systems" }).expect(201)).body.items;
    const t = items.find((x: { label: string }) => x.label === "Data migration");
    await selorm.patch(`/api/admin/change-types/${t.id}`).send({ active: false }).expect(200);
    const meta = (await ama.get("/api/meta").expect(200)).body;
    expect(meta.changeTypes.some((x: { label: string }) => x.label === "Data migration")).toBe(false);
  });
});

describe("users", () => {
  it("invite → can't sign in → reset password → signs in with the temporary password", async () => {
    const u = (await selorm.post("/api/admin/users").send({ name: "Test Invitee", email: "Test.Invitee@milifeghana.com", departmentId: testDept.id, role: "requester" }).expect(201)).body;
    expect(u).toMatchObject({ email: "test.invitee@milifeghana.com", status: "Invited" });
    expect(u.code).toMatch(/^USR-\d{4}$/);

    await login("test.invitee@milifeghana.com", "anything").expect(401);
    const res = await selorm.post(`/api/admin/users/${u.id}/reset-password`).expect(200).expect("cache-control", "no-store");
    const { temporaryPassword } = res.body;
    expect(temporaryPassword).toHaveLength(12);

    await login("test.invitee@milifeghana.com", temporaryPassword).expect(200);
    const after = (await selorm.get("/api/admin/users").query({ q: "Test Invitee" }).expect(200)).body.items[0];
    expect(after.status).toBe("Active");

    // The audit trail records the activation but never the password.
    const audit = (await selorm.get("/api/audit").query({ q: "Test Invitee" }).expect(200)).body.items.map((a: { action: string }) => a.action);
    expect(audit).toEqual(expect.arrayContaining(["Invited Test Invitee as Requester", "Activated Test Invitee with a temporary password"]));
    const raw = await prisma.auditLog.findMany({ where: { action: { contains: "Test Invitee" } } });
    expect(JSON.stringify(raw)).not.toContain(temporaryPassword);
  });

  it("disabling a user ends their session immediately", async () => {
    const u = (await selorm.post("/api/admin/users").send({ name: "Short Lived", email: "short.lived@milifeghana.com", departmentId: testDept.id, role: "requester" }).expect(201)).body;
    const { temporaryPassword } = (await selorm.post(`/api/admin/users/${u.id}/reset-password`).expect(200)).body;
    const session = request.agent(app);
    await session.post("/api/auth/login").send({ email: "short.lived@milifeghana.com", password: temporaryPassword }).expect(200);
    await session.get("/api/auth/me").expect(200);

    await selorm.patch(`/api/admin/users/${u.id}`).send({ status: "Disabled" }).expect(200);
    await session.get("/api/auth/me").expect(401); // same cookie, now refused
    await selorm.post(`/api/admin/users/${u.id}/reset-password`).expect(409); // enable first
  });

  it("guards roles: no self-changes, and only a super admin handles admin roles", async () => {
    const me = (await selorm.get("/api/auth/me")).body;
    await selorm.patch(`/api/admin/users/${me.id}`).send({ role: "requester" }).expect(403);
    await selorm.patch(`/api/admin/users/${me.id}`).send({ status: "Disabled" }).expect(403);

    const u = (await selorm.post("/api/admin/users").send({ name: "Role Target", email: "role.target@milifeghana.com", departmentId: testDept.id, role: "requester" }).expect(201)).body;
    await selorm.patch(`/api/admin/users/${u.id}`).send({ role: "lineManager" }).expect(200);
    const promote = await selorm.patch(`/api/admin/users/${u.id}`).send({ role: "admin" }).expect(403);
    expect(promote.body.error.message).toMatch(/super admin/);
    await selorm.post("/api/admin/users").send({ name: "Sneaky Admin", email: "sneaky@milifeghana.com", departmentId: testDept.id, role: "superAdmin" }).expect(403);

    await superAdmin.patch(`/api/admin/users/${u.id}`).send({ role: "admin" }).expect(200);
    await selorm.patch(`/api/admin/users/${u.id}`).send({ status: "Disabled" }).expect(403); // now an admin account
    await superAdmin.patch(`/api/admin/users/${u.id}`).send({ role: "requester" }).expect(200);

    const audit = (await selorm.get("/api/audit").query({ q: "Role Target" }).expect(200)).body.items.map((a: { action: string }) => a.action);
    expect(audit).toContain("Changed role of Role Target: Requester → Line Manager");
  });

  it("imports from CSV rows: a dry run reports problems, then only valid rows are created", async () => {
    const rows = [
      { name: "Import Good", email: "import.good@milifeghana.com", department: "TST", role: "Requester" },
      { name: "Import Dup", email: "ama.mensah@milifeghana.com", department: "Claims", role: "requester" },
      { name: "Import Bad", email: "import.bad@milifeghana.com", department: "Nowhere", role: "Wizard" },
      { name: "Import Admin", email: "import.admin@milifeghana.com", department: "IT", role: "System Admin" },
      { name: "Import Twice", email: "import.good@milifeghana.com", department: "IT", role: "Implementer" },
    ];
    const dry = (await selorm.post("/api/admin/users/import").send({ rows, dryRun: true }).expect(200)).body;
    expect(dry.created).toBe(0);
    expect(dry.results.map((r: { ok: boolean }) => r.ok)).toEqual([true, false, false, false, false]);
    expect(dry.results[1].errors).toContain("A user with this email already exists");
    expect(dry.results[2].errors).toEqual(['Unknown department "Nowhere"', 'Unknown role "Wizard"']);
    expect(dry.results[3].errors).toContain("Only a super admin can create admin accounts");
    expect(dry.results[4].errors).toContain("Duplicate email in this file");
    expect(dry.results[0].row).toBe(2); // spreadsheet row numbers (row 1 is the header)
    expect(await prisma.user.count({ where: { email: "import.good@milifeghana.com" } })).toBe(0);

    const real = (await selorm.post("/api/admin/users/import").send({ rows, dryRun: false }).expect(200)).body;
    expect(real.created).toBe(1);
    expect(await prisma.user.findUnique({ where: { email: "import.good@milifeghana.com" }, select: { status: true } })).toEqual({ status: "Invited" });
  });

  it("filters, counts and exports users", async () => {
    const list = (await selorm.get("/api/admin/users").query({ status: "Invited", pageSize: 100 }).expect(200)).body;
    expect(list.items.every((u: { status: string }) => u.status === "Invited")).toBe(true);
    expect(list.total).toBe(list.counts.Invited);
    const csv = await selorm.get("/api/admin/users/export.csv").expect(200).expect("content-type", /text\/csv/);
    expect(csv.text).toContain("Code,Name,Email,Role,Department,Status");
  });
});

describe("workflows", () => {
  it("sets a department route, uses it immediately, and resets it to the default", async () => {
    await ama.put("/api/admin/workflows").send({ departmentId: testDept.id, tier: "Low", roles: ["changeManager"] }).expect(403);
    await selorm.put("/api/admin/workflows").send({ departmentId: testDept.id, tier: "Low", roles: ["changeManager", "exec"] }).expect(204);

    const wf = (await ama.get("/api/workflows").expect(200)).body;
    expect(wf.overrides[testDept.id]).toEqual({ Low: ["changeManager", "exec"] });
    const preview = (await ama.get("/api/changes/route-preview").query({ departmentId: testDept.id, impact: 1, likelihood: 1 }).expect(200)).body;
    expect(preview.route.map((r: { role: string }) => r.role)).toEqual(["changeManager", "exec"]);

    await selorm.put("/api/admin/workflows").send({ departmentId: testDept.id, tier: "Low", roles: [] }).expect(204);
    expect((await ama.get("/api/workflows")).body.overrides[testDept.id]).toBeUndefined();
    const audit = (await selorm.get("/api/audit").query({ q: "Testing Unit" }).expect(200)).body.items.map((a: { action: string }) => a.action);
    expect(audit).toEqual(expect.arrayContaining(["Updated workflow: Testing Unit · Low: Change Manager → Executive", "Reset workflow to default: Testing Unit · Low"]));
  });

  it("rejects invalid routes", async () => {
    const empty = await selorm.put("/api/admin/workflows").send({ departmentId: null, tier: "Low", roles: [] }).expect(400);
    expect(empty.body.error.fields.roles).toMatch(/at least one stage/);
    await selorm.put("/api/admin/workflows").send({ departmentId: null, tier: "Low", roles: ["lineManager", "lineManager"] }).expect(400);
    await selorm.put("/api/admin/workflows").send({ departmentId: null, tier: "Low", roles: ["requester"] }).expect(400); // not an approver role
  });
});
