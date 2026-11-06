"use client";

import { RISK_TIERS, type ReportPeriod } from "@crms/shared";
import { Download } from "lucide-react";
import { useState } from "react";
import { RequirePerm } from "@/components/layout/SessionGate";
import { BarList, MonthlyOutcome } from "@/components/reports/Charts";
import { buttonClass } from "@/components/ui/Button";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Form";
import { DashboardSkeleton, ErrorState } from "@/components/ui/States";
import { ymd } from "@/lib/dates";
import { exportUrl, useReports } from "@/lib/queries";

export default function ReportsPage() {
  return (
    <RequirePerm screen="reports">
      <Reports />
    </RequirePerm>
  );
}

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 1000) / 10}%`);
const hours = (h: number) => (h >= 48 ? `${Math.round((h / 24) * 10) / 10} d` : `${h} h`);

function Reports() {
  const [period, setPeriod] = useState<ReportPeriod>("year");
  // Custom range: starts as this year to date, so there is always something to show.
  const [from, setFrom] = useState<string | undefined>(() => `${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState<string | undefined>(() => ymd(new Date()));
  const custom = period === "custom";
  const report = useReports(period, from, to);

  if (report.isPending) return <DashboardSkeleton />;
  if (report.isError) return <ErrorState error={report.error} />;
  const r = report.data;

  return (
    <div className={`space-y-4 ${report.isPlaceholderData ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{r.period.label} · all departments · drafts excluded</p>
        <div className="flex flex-wrap gap-2">
          <div className="w-40">
            <Select aria-label="Period" value={period} onChange={(e) => setPeriod(e.target.value as ReportPeriod)}>
              <option value="quarter">This quarter</option>
              <option value="year">This year</option>
              <option value="all">All time</option>
              <option value="custom">Custom range…</option>
            </Select>
          </div>
          {custom && (
            <>
              <div className="w-44"><DatePicker id="report-from" aria-label="Report from" placeholder="From" value={from} max={to} clearable onChange={setFrom} /></div>
              <div className="w-44"><DatePicker id="report-to" aria-label="Report to" placeholder="To" value={to} min={from} clearable onChange={setTo} /></div>
            </>
          )}
          <a href={exportUrl("/reports/export.csv", custom ? { period, from, to } : { period })} className={buttonClass("secondary")} download>
            <Download size={15} /> Export CSV
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Change requests raised" value={r.kpis.raised} sub={`${r.kpis.emergencies} emergency`} />
        <StatCard label="Approval rate" value={pct(r.kpis.approvalRate)} sub={`${r.kpis.rejected} rejected`} />
        <StatCard label="Avg. time to approve" value={r.kpis.avgApprovalDays === null ? "—" : `${r.kpis.avgApprovalDays} d`} sub="Submit → final approval" />
        <StatCard label="Change success rate" value={pct(r.kpis.successRate)} sub="From post-implementation reviews" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Changes by department" right={r.period.label} />
          <div className="p-4">
            {r.byDepartment.length ? <BarList label="Changes by department" rows={r.byDepartment.map((d) => ({ name: d.name, value: d.count }))} /> : <p className="text-sm text-muted">No changes in this period.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Monthly volume and outcome" right="Last 6 months" />
          <div className="p-4"><MonthlyOutcome months={r.monthly} /></div>
        </Card>
        <Card>
          <CardHeader title="Average wait for a decision, by stage" right="Lower is better" />
          <div className="p-4">
            {r.decisionTimeByRole.length ? (
              <BarList label="Average wait for a decision by stage" rows={r.decisionTimeByRole.map((d) => ({ name: d.label, value: d.avgHours }))} format={hours} />
            ) : <p className="text-sm text-muted">No decisions in this period.</p>}
            <p className="mt-2 text-xs text-muted">From when a stage became due (submission or the previous decision) to its decision. The SLA is 2 working days.</p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Changes by risk tier" right={r.period.label} />
          <div className="p-4">
            <BarList label="Changes by risk tier" rows={RISK_TIERS.map((t) => ({ name: t, value: r.byTier[t] }))} />
          </div>
        </Card>
      </div>
    </div>
  );
}
