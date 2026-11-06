"use client";

import type { ChangeDetail, ChangeStatus } from "@crms/shared";
import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Mono, Pill, RiskBadge, StatusBadge } from "@/components/ui/Badges";
import { Card, CardHeader, Facts } from "@/components/ui/Card";
import { DetailSkeleton, ErrorState } from "@/components/ui/States";
import { formatDate } from "@/lib/format";
import { useChange } from "@/lib/queries";
import ActionPanel from "./ActionPanel";
import { ActivityTab, ApprovalsTab, ImplementationTab, OverviewTab, PirTab, RiskTab } from "./Tabs";

const TABS = [
  ["overview", "Overview"],
  ["risk", "Risk & impact"],
  ["approvals", "Approvals"],
  ["impl", "Implementation"],
  ["pir", "Post-review"],
  ["activity", "Activity"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function ChangeDetailView({ changeRef }: { changeRef: string }) {
  const { data: c, isPending, isError, error } = useChange(changeRef);
  const [tab, setTab] = useState<Tab>("overview");
  if (isPending) return <DetailSkeleton />;
  if (isError) return <ErrorState error={error} />;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/changes" className="text-sm font-semibold text-teal hover:underline">← Change requests</Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Mono>{c.ref}</Mono>
          <StatusBadge status={c.status} />
          <RiskBadge risk={c.tier === "Emergency" ? "Emergency" : c.risk} />
          <span className="text-xs font-semibold text-ink-2">{c.type.label}</span>
          <span className="text-xs font-semibold text-muted">{c.tier} route</span>
        </div>
        <h2 className="mt-1 text-2xl font-extrabold text-ink">{c.title}</h2>
      </div>

      <LifecycleBar status={c.status} />
      <ActionPanel change={c} onShowTab={setTab} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <div role="tablist" aria-label="Change request sections" className="flex overflow-x-auto border-b border-line px-1 [scrollbar-width:none]">
            {TABS.map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`border-b-2 px-2.5 py-3 text-sm font-bold whitespace-nowrap ${tab === key ? "border-teal text-teal-strong" : "border-transparent text-ink-2 hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="p-4">
            {tab === "overview" && <OverviewTab c={c} />}
            {tab === "risk" && <RiskTab c={c} />}
            {tab === "approvals" && <ApprovalsTab c={c} />}
            {tab === "impl" && <ImplementationTab c={c} />}
            {tab === "pir" && <PirTab c={c} />}
            {tab === "activity" && <ActivityTab c={c} />}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <Facts
              rows={[
                { label: "Requester", value: c.requester.name },
                { label: "Department", value: c.department.name },
                { label: "Created", value: formatDate(c.createdAt) },
                { label: "Planned", value: formatDate(c.plannedDate) },
                { label: "Window", value: c.window ?? "—" },
                { label: "Implementer", value: c.implementer?.name ?? "—" },
              ]}
            />
          </Card>
          <RouteCard c={c} />
        </div>
      </div>
    </div>
  );
}

/** Draft → Pending approval → Scheduled → In progress → Implemented → Closed, like the prototype. */
function LifecycleBar({ status }: { status: ChangeStatus }) {
  const stages = ["Draft", "Pending approval", "Scheduled", "In progress", "Implemented", "Closed"];
  const index: Record<ChangeStatus, number> = {
    Draft: 0, PendingApproval: 1, ReturnedForRework: 1, Rejected: 1, Approved: 2, Scheduled: 2, InProgress: 3, Implemented: 4, Closed: 5,
  };
  const at = index[status];
  const problem = status === "Rejected" ? "Rejected" : status === "ReturnedForRework" ? "Returned" : null;

  return (
    <Card className="overflow-x-auto px-4 py-3">
      <ol className="flex min-w-max items-center gap-2">
        {stages.map((label, i) => {
          const done = i < at || status === "Closed";
          const current = i === at && status !== "Closed";
          const tone = current && problem ? (status === "Rejected" ? "red" : "pink") : null;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`flex size-6 items-center justify-center rounded-full text-xs font-extrabold ${
                  done ? "bg-teal text-white" : current && !tone ? "bg-navy text-white" : !tone ? "border border-line-strong text-muted" : ""
                }`}
                style={tone ? { background: `var(--${tone}-fg)`, color: "white" } : undefined}
              >
                {done ? <Check size={13} strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-sm ${current ? "font-extrabold text-ink" : "font-semibold text-muted"}`}>
                {current && problem ? `${label} · ${problem}` : label}
              </span>
              {i < stages.length - 1 && <span className={`h-px w-8 ${done ? "bg-teal" : "bg-line-strong"}`} />}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function RouteCard({ c }: { c: ChangeDetail }) {
  return (
    <Card>
      <CardHeader title="Approval route" right={`${c.tier} · ${c.steps.length || "—"} stages`} />
      {c.steps.length ? (
        <ol className="space-y-2 p-4">
          {c.steps.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-ink">
                {s.order + 1}. {s.roleLabel}
              </span>
              <StepPill status={s.status} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="p-4 text-sm text-muted">The route is worked out when the request is submitted.</p>
      )}
    </Card>
  );
}

export function StepPill({ status }: { status: ChangeDetail["steps"][number]["status"] }) {
  const map = {
    approved: ["green", "Approved"],
    pending: ["amber", "Awaiting decision"],
    waiting: ["gray", "Not started"],
    rejected: ["red", "Rejected"],
    returned: ["pink", "Returned"],
    skipped: ["gray", "Skipped"],
  } as const;
  const [tone, label] = map[status];
  return <Pill tone={tone}>{label}</Pill>;
}
