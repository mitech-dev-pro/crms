"use client";

import { ROLE_LABELS, type ChangeListItem, type SessionUser } from "@crms/shared";
import Link from "next/link";
import { useState } from "react";
import ChangeTable from "@/components/changes/ChangeTable";
import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { DashboardSkeleton, ErrorState, Spinner } from "@/components/ui/States";
import { formatDate, greeting } from "@/lib/format";
import { useChanges, useInbox, useMe, useMeta } from "@/lib/queries";

const APPROVER_ROLES = ["lineManager", "deptHead", "cab", "risk", "exec"];

export default function DashboardPage() {
  const { data: me } = useMe();
  if (!me) return <Spinner />;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold text-ink">
            {greeting()}, {me.name.split(" ")[0]}
          </h2>
          <p className="text-sm text-muted">
            {today} · {me.title ?? ROLE_LABELS[me.role]}
          </p>
        </div>
        {me.permissions.includes("new") && <ButtonLink href="/changes/new">New request</ButtonLink>}
      </div>
      <FreezeBanner />
      {me.permissions.includes("changes") ? <RoleDashboard me={me} /> : <AdminDashboard />}
    </div>
  );
}

/** Warns about a freeze window that is active now or starts within 14 days. */
function FreezeBanner() {
  const { data } = useMeta();
  // Read the clock once, when the banner first mounts. Rendering must stay pure.
  const [{ today, soon }] = useState(() => {
    const now = Date.now();
    return { today: new Date(now).toISOString().slice(0, 10), soon: new Date(now + 14 * 86_400_000).toISOString().slice(0, 10) };
  });
  const freeze = data?.freezes.find((f) => f.to >= today && f.from <= soon);
  if (!freeze) return null;
  const active = freeze.from <= today;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm" style={{ background: "var(--amber-bg)", borderColor: "color-mix(in srgb, var(--amber-fg) 30%, transparent)", color: "var(--amber-fg)" }}>
      <span className="rounded bg-[var(--amber-fg)] px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-[var(--amber-bg)] uppercase">Freeze</span>
      <span>
        <b>{freeze.name}</b> {active ? "is in effect until" : `starts ${formatDate(freeze.from)} and runs to`} {formatDate(freeze.to)}. Only
        emergency changes, or changes with an Executive override, are permitted.
      </span>
    </div>
  );
}

function RoleDashboard({ me }: { me: SessionUser }) {
  const isImplementer = me.role === "implementer";
  const isApprover = APPROVER_ROLES.includes(me.role);
  const isChangeManager = me.role === "changeManager" || me.role === "superAdmin";

  // One list call gives both recent items and per-status counts (scoped to what this user may see).
  const list = useChanges(isImplementer ? { implementerId: me.id, sort: "planned", pageSize: 20 } : { sort: "newest", pageSize: 8 });
  const inbox = useInbox(isApprover || isChangeManager);
  const implemented = useChanges({ status: "Implemented", pageSize: 20 }, isChangeManager);
  const upcoming = useChanges({ status: "Scheduled", sort: "planned", pageSize: 5 });

  if (list.isPending) return <DashboardSkeleton />;
  if (list.isError) return <ErrorState error={list.error} />;
  const c = list.data.counts;
  const inboxItems = inbox.data?.items ?? [];

  let kpis: { label: string; value: number; sub: string }[];
  let actionTitle: string;
  let actionItems: ChangeListItem[];

  if (me.role === "requester") {
    kpis = [
      { label: "My open requests", value: list.data.total - c.Closed - c.Rejected, sub: "Across all statuses" },
      { label: "Awaiting approval", value: c.PendingApproval, sub: "In approval routes" },
      { label: "Drafts", value: c.Draft, sub: "Not yet submitted" },
      { label: "Returned to me", value: c.ReturnedForRework, sub: "Need your update" },
    ];
    actionTitle = "My change requests";
    actionItems = list.data.items.filter((i) => i.status !== "Closed");
  } else if (isImplementer) {
    kpis = [
      { label: "Assigned to me", value: list.data.total - c.Closed - c.Rejected, sub: "Open changes" },
      { label: "Ready to start", value: c.Scheduled + c.Approved, sub: "Approved & scheduled" },
      { label: "In progress", value: c.InProgress, sub: "Checklist open" },
      { label: "Awaiting review", value: c.Implemented, sub: "Post-implementation review" },
    ];
    actionTitle = "My implementation queue";
    actionItems = list.data.items.filter((i) => ["Scheduled", "Approved", "InProgress", "Implemented"].includes(i.status));
  } else if (isChangeManager) {
    kpis = [
      { label: "Pending approval", value: c.PendingApproval, sub: "All departments" },
      { label: "Scheduled", value: c.Scheduled, sub: "Approved & planned" },
      { label: "In progress", value: c.InProgress, sub: "Being implemented" },
      { label: "Awaiting review", value: c.Implemented, sub: "Post-implementation review" },
    ];
    actionTitle = "Needs attention";
    actionItems = [...inboxItems, ...(implemented.data?.items ?? [])];
  } else {
    kpis = [
      { label: "Awaiting my decision", value: inboxItems.length, sub: "At your stage" },
      { label: "Pending approval", value: c.PendingApproval, sub: "Company-wide" },
      { label: "Scheduled", value: c.Scheduled, sub: "Approved & planned" },
      { label: "In progress", value: c.InProgress, sub: "Being implemented" },
    ];
    actionTitle = "Awaiting your decision";
    actionItems = inboxItems;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <StatCard key={k.label} {...k} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader title={actionTitle} right={`${actionItems.length} items`} />
          <ChangeTable items={actionItems} empty="Nothing needs your attention" />
        </Card>
        <Card>
          <CardHeader title="Upcoming changes" />
          {upcoming.data?.items.length ? (
            <ul className="divide-y divide-line">
              {upcoming.data.items.map((u) => (
                <UpcomingItem key={u.id} item={u} />
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-muted">No scheduled changes.</p>
          )}
        </Card>
      </div>
    </>
  );
}

function UpcomingItem({ item }: { item: ChangeListItem }) {
  const d = item.plannedDate ? new Date(item.plannedDate + "T00:00:00") : null;
  return (
    <li>
      <Link href={`/changes/${item.ref}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
        <div className="w-11 shrink-0 rounded-lg border border-line py-1 text-center">
          <p className="text-[10px] font-extrabold text-teal uppercase">{d?.toLocaleDateString("en-GB", { month: "short" }) ?? "—"}</p>
          <p className="text-lg leading-none font-extrabold text-ink">{d?.getDate() ?? ""}</p>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{item.title}</p>
          <p className="truncate text-xs text-muted">
            {item.window ?? "—"} · {item.implementer?.name ?? "Unassigned"}
          </p>
        </div>
      </Link>
    </li>
  );
}

/** System Admins don't see change data; they manage users and configuration (Phase 6). */
function AdminDashboard() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="p-5">
        <h3 className="font-extrabold text-ink">Administration</h3>
        <p className="mt-1 text-sm text-muted">Departments, users, change types and approval workflows.</p>
        <ButtonLink href="/admin" variant="secondary" className="mt-4">Open administration</ButtonLink>
      </Card>
      <Card className="p-5">
        <h3 className="font-extrabold text-ink">Audit trail</h3>
        <p className="mt-1 text-sm text-muted">Every sign-in, decision and configuration change.</p>
        <ButtonLink href="/audit" variant="secondary" className="mt-4">Open audit trail</ButtonLink>
      </Card>
    </div>
  );
}
