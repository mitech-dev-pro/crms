import {
  CHANGE_STATUSES, RISK_TIERS, ROLE_LABELS,
  type ChangeStatus, type ReportPeriod, type ReportsQuery, type ReportsResponse, type RiskTier, type Role,
} from "@crms/shared";
import { prisma } from "../../lib/db";

const APPROVED: ChangeStatus[] = ["Approved", "Scheduled", "InProgress", "Implemented", "Closed"];
const DECIDED = ["approved", "rejected", "returned"];

export type ReportRow = {
  status: ChangeStatus;
  tier: RiskTier;
  emergency: boolean;
  createdAt: Date;
  submittedAt: Date | null;
  department: { name: string };
  steps: { order: number; role: Role; status: string; decidedAt: Date | null }[];
  pir: { outcome: string; reviewedAt: Date } | null;
};

/** First day of the period: this quarter, this year, or no limit. */
export function periodStart(period: ReportPeriod, now = new Date()): Date | null {
  if (period === "all" || period === "custom") return null;
  const month = period === "quarter" ? Math.floor(now.getUTCMonth() / 3) * 3 : 0;
  return new Date(Date.UTC(now.getUTCFullYear(), month, 1));
}

/** The reporting window: inclusive days, either end may be open. */
export type ReportRange = { key: ReportPeriod; label: string; from: string | null; to: string | null };

const dayLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Turns ?period (and from/to for a custom range) into dates and a label. */
export function reportRange(q: Pick<ReportsQuery, "period"> & Partial<Pick<ReportsQuery, "from" | "to">>, now = new Date()): ReportRange {
  if (q.period === "custom") {
    const from = q.from ?? null, to = q.to ?? null;
    const label = from && to ? `${dayLabel(from)} – ${dayLabel(to)}` : from ? `Since ${dayLabel(from)}` : `Up to ${dayLabel(to!)}`;
    return { key: "custom", label, from, to };
  }
  const start = periodStart(q.period, now);
  const labels = { quarter: "This quarter", year: `${now.getUTCFullYear()} to date`, all: "All time" } as const;
  return { key: q.period, label: labels[q.period], from: start ? start.toISOString().slice(0, 10) : null, to: null };
}

/** Prisma filter on createdAt for a range ("to" covers the whole day). */
const createdIn = (r: ReportRange) =>
  r.from || r.to
    ? {
        createdAt: {
          ...(r.from && { gte: new Date(`${r.from}T00:00:00Z`) }),
          ...(r.to && { lt: new Date(new Date(`${r.to}T00:00:00Z`).getTime() + 86_400_000) }),
        },
      }
    : {};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (n: number | null, dp = 1) => (n === null ? null : Math.round(n * 10 ** dp) / 10 ** dp);
const HOUR = 3_600_000;

/**
 * Turns changes into report figures. Pure (no database) so it can be unit-tested.
 * `rows` are the changes in the period; `recent` covers the last 6 months for the monthly chart.
 */
export function buildReport(range: ReportRange | ReportPeriod, rows: ReportRow[], recent: ReportRow[], now = new Date()): ReportsResponse {
  const period = typeof range === "string" ? reportRange({ period: range }, now) : range;
  const approved = rows.filter((r) => APPROVED.includes(r.status));
  const rejected = rows.filter((r) => r.status === "Rejected").length;
  const pirs = rows.flatMap((r) => (r.pir ? [r.pir] : []));
  const isSuccess = (outcome: string) => outcome === "Successful" || outcome === "SuccessfulWithIssues";

  // Submit → last approval, in days.
  const approvalDays = approved.flatMap((r) => {
    const last = r.steps.filter((s) => s.decidedAt).sort((a, b) => b.order - a.order)[0];
    return r.submittedAt && last?.decidedAt ? [(last.decidedAt.getTime() - r.submittedAt.getTime()) / (24 * HOUR)] : [];
  });

  // How long each stage waited for its decision: from submit (first stage) or the previous decision.
  const waits = new Map<Role, number[]>();
  for (const r of rows) {
    const steps = [...r.steps].sort((a, b) => a.order - b.order);
    steps.forEach((s, i) => {
      const since = i === 0 ? r.submittedAt : steps[i - 1]!.decidedAt;
      if (!DECIDED.includes(s.status) || !s.decidedAt || !since) return;
      const hours = (s.decidedAt.getTime() - since.getTime()) / HOUR;
      if (hours >= 0) waits.set(s.role, [...(waits.get(s.role) ?? []), hours]);
    });
  }

  const byDept = new Map<string, number>();
  for (const r of rows) byDept.set(r.department.name, (byDept.get(r.department.name) ?? 0) + 1);

  const byTier = Object.fromEntries(RISK_TIERS.map((t) => [t, 0])) as Record<RiskTier, number>;
  const byStatus = Object.fromEntries(CHANGE_STATUSES.map((s) => [s, 0])) as Record<ChangeStatus, number>;
  for (const r of rows) {
    byTier[r.tier]++;
    byStatus[r.status]++;
  }

  // Last 6 calendar months, oldest first.
  const monthly = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5 + i, 1));
    const key = d.toISOString().slice(0, 7);
    const inMonth = (x: Date) => x.toISOString().slice(0, 7) === key;
    const reviews = recent.flatMap((r) => (r.pir && inMonth(r.pir.reviewedAt) ? [r.pir] : []));
    return {
      month: key,
      label: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      raised: recent.filter((r) => inMonth(r.createdAt)).length,
      successful: reviews.filter((p) => isSuccess(p.outcome)).length,
      failed: reviews.filter((p) => !isSuccess(p.outcome)).length,
    };
  });

  return {
    period,
    kpis: {
      raised: rows.length,
      approvalRate: approved.length + rejected ? round(approved.length / (approved.length + rejected), 3) : null,
      avgApprovalDays: round(avg(approvalDays)),
      successRate: pirs.length ? round(pirs.filter((p) => isSuccess(p.outcome)).length / pirs.length, 3) : null,
      emergencies: rows.filter((r) => r.emergency).length,
      rejected,
    },
    byDepartment: [...byDept].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    byTier,
    byStatus,
    monthly,
    decisionTimeByRole: [...waits]
      .map(([role, hours]) => ({ role, label: ROLE_LABELS[role], avgHours: round(avg(hours))!, decisions: hours.length }))
      .sort((a, b) => b.avgHours - a.avgHours),
  };
}

const select = {
  status: true, tier: true, emergency: true, createdAt: true, submittedAt: true,
  department: { select: { name: true } },
  steps: { select: { order: true, role: true, status: true, decidedAt: true } },
  pir: { select: { outcome: true, reviewedAt: true } },
} as const;

/** Company-wide figures. Drafts are private and never counted. */
export async function getReport(q: ReportsQuery, now = new Date()) {
  const range = reportRange(q, now);
  const sixMonthsAgo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const [rows, recent] = await Promise.all([
    prisma.change.findMany({ where: { status: { not: "Draft" }, ...createdIn(range) }, select }),
    prisma.change.findMany({
      where: { status: { not: "Draft" }, OR: [{ createdAt: { gte: sixMonthsAgo } }, { pir: { reviewedAt: { gte: sixMonthsAgo } } }] },
      select,
    }),
  ]);
  return buildReport(range, rows, recent, now);
}
