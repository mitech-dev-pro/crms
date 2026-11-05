// Calendar, freeze windows, process flows, reports and CSV exports.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toCsv } from "../src/lib/csv";
import { prisma } from "../src/lib/db";
import { buildReport, periodStart, type ReportRow } from "../src/modules/reports/service";
import { signIn, type Agent } from "./helpers";

let ama: Agent, yaw: Agent, selorm: Agent, kwame: Agent;
beforeAll(async () => {
  [ama, yaw, selorm, kwame] = (await Promise.all(["ama.mensah", "yaw.owusu", "selorm.dzidzienyo", "kwame.boateng"].map(signIn))) as [Agent, Agent, Agent, Agent];
});
afterAll(() => prisma.$disconnect());

/** Parses our CSV output (enough for these tests: quoted cells with doubled quotes). */
const parseCsv = (text: string) =>
  text.replace(/^﻿/, "").split("\r\n").map((line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.slice(0, -1).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')));

describe("CSV safety", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv([["a,b", 'say "hi"', "line1\nline2", null, 3]])).toBe('"a,b","say ""hi""","line1\nline2",,3');
  });

  it("neutralises spreadsheet formulas in text cells", () => {
    expect(toCsv([["=HYPERLINK(\"x\")", "+1", "-2", "@SUM(A1)", "normal"]])).toBe(`"'=HYPERLINK(""x"")",'+1,'-2,'@SUM(A1),normal`);
    expect(toCsv([[-5]])).toBe("-5"); // real numbers are left alone
  });
});

describe("report maths", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const at = (s: string) => new Date(s);
  const row = (over: Partial<ReportRow>): ReportRow => ({
    status: "Closed", tier: "Medium", emergency: false, createdAt: at("2026-10-01"), submittedAt: at("2026-10-01T09:00:00Z"),
    department: { name: "IT" }, steps: [], pir: null, ...over,
  });

  it("starts periods at the quarter or year", () => {
    expect(periodStart("quarter", now)?.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(periodStart("year", now)?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(periodStart("all", now)).toBeNull();
  });

  it("computes approval rate, approval time, success rate and stage waits", () => {
    const rows = [
      row({
        steps: [
          { order: 0, role: "lineManager", status: "approved", decidedAt: at("2026-10-01T15:00:00Z") }, // waited 6h
          { order: 1, role: "changeManager", status: "approved", decidedAt: at("2026-10-03T09:00:00Z") }, // waited 42h
        ],
        pir: { outcome: "Successful", reviewedAt: at("2026-10-10") },
      }),
      row({ status: "Rejected", department: { name: "Claims" }, steps: [{ order: 0, role: "lineManager", status: "rejected", decidedAt: at("2026-10-01T11:00:00Z") }] }), // 2h
      row({ status: "Implemented", emergency: true, tier: "Emergency", pir: { outcome: "RolledBack", reviewedAt: at("2026-10-20") } }),
    ];
    const r = buildReport("all", rows, rows, now);
    expect(r.kpis).toMatchObject({ raised: 3, rejected: 1, emergencies: 1, approvalRate: 0.667, avgApprovalDays: 2, successRate: 0.5 });
    expect(r.byDepartment).toEqual([{ name: "IT", count: 2 }, { name: "Claims", count: 1 }]);
    expect(r.decisionTimeByRole).toEqual([
      { role: "changeManager", label: "Change Manager", avgHours: 42, decisions: 1 },
      { role: "lineManager", label: "Line Manager", avgHours: 4, decisions: 2 },
    ]);
    const oct = r.monthly.find((m) => m.month === "2026-10")!;
    expect(oct).toMatchObject({ raised: 3, successful: 1, failed: 1 });
    expect(r.monthly).toHaveLength(6);
  });
});

describe("calendar", () => {
  it("shows changes planned in the range with the overlapping freezes", async () => {
    const { body } = await yaw.get("/api/calendar").query({ from: "2026-10-01", to: "2026-10-31" }).expect(200);
    const refs = body.items.map((c: { ref: string }) => c.ref);
    expect(refs).toEqual(expect.arrayContaining(["CHG-2026-0137", "CHG-2026-0133", "CHG-2026-0138"]));
    expect(refs).not.toContain("CHG-2026-0130"); // rejected changes are left off the calendar
    expect(body.freezes.map((f: { from: string }) => f.from)).toEqual(["2026-10-28"]);
  });

  it("requesters only see their own changes on it", async () => {
    const { body } = await ama.get("/api/calendar").query({ from: "2026-11-01", to: "2026-12-31" }).expect(200);
    expect(body.items.every((c: { requester: { name: string } }) => c.requester.name === "Ama Mensah")).toBe(true);
  });

  it("limits the range", async () => {
    await yaw.get("/api/calendar").query({ from: "2026-01-01", to: "2026-12-31" }).expect(400);
  });
});

describe("freeze windows", () => {
  it("the Change Manager can add and remove one; others can't", async () => {
    await ama.post("/api/freezes").send({ name: "Audit week", from: "2027-06-01", to: "2027-06-05" }).expect(403);
    const bad = await yaw.post("/api/freezes").send({ name: "Audit week", from: "2027-06-05", to: "2027-06-01" }).expect(400);
    expect(bad.body.error.fields.to).toMatch(/on or after/);

    const created = (await yaw.post("/api/freezes").send({ name: "Audit week", from: "2027-06-01", to: "2027-06-05" }).expect(201)).body;
    const departmentId = (await ama.get("/api/auth/me").expect(200)).body.department.id;
    const preview = (await ama.get("/api/changes/route-preview").query({ departmentId, impact: 1, likelihood: 1, plannedDate: "2027-06-03" }).expect(200)).body;
    expect(preview.route.at(-1).role).toBe("exec"); // the new freeze is used straight away

    await ama.delete(`/api/freezes/${created.id}`).expect(403);
    await yaw.delete(`/api/freezes/${created.id}`).expect(204);
    const audit = (await yaw.get("/api/audit").query({ category: "config", q: "Audit week" }).expect(200)).body;
    expect(audit.items.map((a: { action: string }) => a.action)).toEqual([
      "Removed freeze window: Audit week (2027-06-01 – 2027-06-05)",
      "Added freeze window: Audit week (2027-06-01 – 2027-06-05)",
    ]);
  });
});

describe("process flows", () => {
  it("returns the default route and department overrides", async () => {
    const { body } = await ama.get("/api/workflows").expect(200);
    expect(body.default.High).toEqual(["lineManager", "deptHead", "risk", "cab", "changeManager"]);
    const it_ = body.departments.find((d: { name: string }) => d.name === "IT");
    expect(body.overrides[it_.id].Low).toEqual(["changeManager"]);
    expect(body.overrides[body.departments.find((d: { name: string }) => d.name === "Claims").id]).toBeUndefined();
  });
});

describe("reports", () => {
  it("is for roles with the Reports screen only", async () => {
    await ama.get("/api/reports").expect(403);
    await kwame.get("/api/reports").expect(403); // Line Managers don't have Reports
    const { body } = await yaw.get("/api/reports").query({ period: "all" }).expect(200);
    const nonDraft = await prisma.change.count({ where: { status: { not: "Draft" } } });
    expect(body.kpis.raised).toBe(nonDraft);
    expect(body.byDepartment[0].count).toBeGreaterThan(0);
  });
});

describe("CSV exports", () => {
  it("exports the filtered change list, scoped to what the user may see", async () => {
    const res = await ama.get("/api/changes/export.csv").expect(200).expect("content-type", /text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="crms-changes-\d{4}-\d{2}-\d{2}\.csv"/);
    const [header, ...rows] = parseCsv(res.text);
    expect(header![0]).toBe("Reference");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r[7] === "Ama Mensah")).toBe(true); // requester column

    const closed = parseCsv((await yaw.get("/api/changes/export.csv").query({ status: "Closed" }).expect(200)).text);
    expect(closed.slice(1).every((r) => r[2] === "Closed")).toBe(true);
  });

  it("exports the audit trail for auditors only, and audits the export", async () => {
    await ama.get("/api/audit/export.csv").expect(403);
    const res = await selorm.get("/api/audit/export.csv").query({ category: "signin" }).expect(200);
    const [header, ...rows] = parseCsv(res.text);
    expect(header).toEqual(["Time (UTC)", "User", "Role", "Action", "Category", "Reference", "IP address"]);
    expect(rows.every((r) => r[4] === "signin")).toBe(true);

    const latest = (await selorm.get("/api/audit").query({ category: "export", pageSize: 1 }).expect(200)).body.items[0];
    expect(latest).toMatchObject({ action: "Exported audit trail (CSV)", userName: "Selorm Dzidzienyo" });
  });
});
