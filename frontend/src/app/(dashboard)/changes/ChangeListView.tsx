"use client";

import { CHANGE_STATUS_LABELS, RISK_TIERS, type ChangeListQuery, type ChangeStatus } from "@crms/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import ChangeTable from "@/components/changes/ChangeTable";
import { Download } from "lucide-react";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Combobox } from "@/components/ui/Combobox";
import { Input, Select } from "@/components/ui/Form";
import { Pagination } from "@/components/ui/Pagination";
import { ErrorState, TableSkeleton } from "@/components/ui/States";
import { exportUrl, useChanges, useMe, useMeta } from "@/lib/queries";

// Status chips, in the prototype's order.
const CHIPS: ("All" | ChangeStatus)[] = ["All", "PendingApproval", "ReturnedForRework", "Scheduled", "InProgress", "Implemented", "Closed", "Rejected", "Draft"];

export default function ChangeListView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: me } = useMe();
  const meta = useMeta();

  // The URL is the single source of truth for filters.
  const query: Partial<ChangeListQuery> = {
    q: params.get("q") ?? undefined,
    status: (params.get("status") as ChangeStatus) || undefined,
    departmentId: params.get("departmentId") ?? undefined,
    typeId: params.get("typeId") ?? undefined,
    tier: (params.get("tier") as ChangeListQuery["tier"]) || undefined,
    sort: (params.get("sort") as ChangeListQuery["sort"]) || "planned",
    page: Number(params.get("page") ?? 1),
    pageSize: 10,
  };
  const list = useChanges(query);

  /** Update some filters in the URL; any filter change goes back to page 1. */
  const setParams = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in changes)) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  // Search box: type freely, update the URL 300ms after typing stops.
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  // If the URL's q changes from elsewhere (e.g. the header search), show it in the box.
  // Adjusting state during render like this is React's recommended alternative to an effect.
  const [syncedQ, setSyncedQ] = useState(urlQ);
  if (urlQ !== syncedQ) {
    setSyncedQ(urlQ);
    setQ(urlQ);
  }
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q.trim()) setParams({ q: q.trim() || undefined });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [q]);

  const counts = list.data?.counts;
  const all = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{me?.role === "requester" ? "Your change requests" : "All change requests you can see"}</p>
        <div className="flex gap-2">
          {/* Exports exactly what the filters show (all pages). */}
          <a href={exportUrl("/changes/export.csv", { ...query, page: undefined, pageSize: undefined })} className={buttonClass("secondary")} download>
            <Download size={15} /> Export CSV
          </a>
          {me?.permissions.includes("new") && <ButtonLink href="/changes/new">New request</ButtonLink>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {CHIPS.map((s) => {
          const active = (query.status ?? "All") === s;
          const n = s === "All" ? all : counts?.[s];
          return (
            <button
              key={s}
              onClick={() => setParams({ status: s === "All" ? undefined : s })}
              aria-pressed={active}
              className={`rounded-full border px-3 py-1 text-xs font-bold ${active ? "border-navy bg-navy text-white" : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2"}`}
            >
              {s === "All" ? "All" : CHANGE_STATUS_LABELS[s]}
              {n !== undefined && <span className="ml-1.5 font-semibold">{n}</span>}
            </button>
          );
        })}
      </div>

      <Card>
        <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ID or title" aria-label="Search" className="lg:col-span-1" />
          <Combobox
            aria-label="Department"
            value={query.departmentId}
            noneLabel="All departments"
            options={(meta.data?.departments ?? []).map((d) => ({ value: d.id, label: d.name, hint: d.code }))}
            onChange={(v) => setParams({ departmentId: v })}
          />
          <Select aria-label="Change type" value={query.typeId ?? ""} onChange={(e) => setParams({ typeId: e.target.value || undefined })}>
            <option value="">All types</option>
            {meta.data?.changeTypes.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
          <Select aria-label="Risk tier" value={query.tier ?? ""} onChange={(e) => setParams({ tier: e.target.value || undefined })}>
            <option value="">All risk tiers</option>
            {RISK_TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <Select aria-label="Sort" value={query.sort} onChange={(e) => setParams({ sort: e.target.value })}>
            <option value="planned">Sort: planned date</option>
            <option value="newest">Sort: newest first</option>
            <option value="risk">Sort: highest risk</option>
            <option value="ref">Sort: reference</option>
          </Select>
        </div>

        {list.isPending ? <TableSkeleton rows={8} cols={6} /> : list.isError ? <div className="p-4"><ErrorState error={list.error} /></div> : (
          <div className={list.isPlaceholderData ? "opacity-60" : ""}>
            <ChangeTable items={list.data.items} empty="No change requests match these filters" />
            <Pagination page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onPage={(p) => setParams({ page: String(p) })} />
          </div>
        )}
      </Card>
    </div>
  );
}
