import { CHANGE_STATUS_LABELS, RISK_TIERS, reportsQuerySchema } from "@crms/shared";
import { Router } from "express";
import { datedName, sendCsv } from "../../lib/csv";
import { requireAuth, requirePerm } from "../../middleware/auth";
import { writeAudit } from "../../services/audit";
import { getReport } from "./service";

export const reportsRouter = Router();
reportsRouter.use(requireAuth, requirePerm("reports"));

// GET /api/reports?period=quarter|year|all, or period=custom&from=&to=
reportsRouter.get("/", async (req, res) => {
  res.json(await getReport(reportsQuerySchema.parse(req.query)));
});

// GET /api/reports/export.csv?period=… — the same figures as a flat CSV.
reportsRouter.get("/export.csv", async (req, res) => {
  const r = await getReport(reportsQuerySchema.parse(req.query));
  await writeAudit({ action: `Exported report (CSV): ${r.period.label}`, category: "export", user: req.user!, ip: req.ip });
  const pct = (n: number | null) => (n === null ? "" : `${Math.round(n * 1000) / 10}%`);

  sendCsv(res, datedName("report"), [
    ["Section", "Item", "Value"],
    ["Period", r.period.label, `${r.period.from ?? "start"} to ${r.period.to ?? "today"}`],
    ["KPI", "Change requests raised", r.kpis.raised],
    ["KPI", "Approval rate", pct(r.kpis.approvalRate)],
    ["KPI", "Average days to approve", r.kpis.avgApprovalDays ?? ""],
    ["KPI", "Change success rate", pct(r.kpis.successRate)],
    ["KPI", "Emergency changes", r.kpis.emergencies],
    ["KPI", "Rejected", r.kpis.rejected],
    ...r.byDepartment.map((d) => ["By department", d.name, d.count]),
    ...RISK_TIERS.map((t) => ["By risk tier", t, r.byTier[t]]),
    ...Object.entries(r.byStatus).map(([s, n]) => ["By status", CHANGE_STATUS_LABELS[s as keyof typeof CHANGE_STATUS_LABELS], n]),
    ...r.monthly.flatMap((m) => [
      ["Monthly raised", m.month, m.raised],
      ["Monthly successful", m.month, m.successful],
      ["Monthly failed / rolled back", m.month, m.failed],
    ]),
    ...r.decisionTimeByRole.map((d) => ["Avg hours to decide", d.label, d.avgHours]),
  ]);
});
