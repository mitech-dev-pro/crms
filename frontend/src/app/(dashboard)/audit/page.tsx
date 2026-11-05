"use client";

import { AUDIT_CATEGORIES, ROLES, ROLE_LABELS, type AuditCategory, type Role } from "@crms/shared";
import { Download } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RequirePerm } from "@/components/layout/SessionGate";
import { Mono, Pill } from "@/components/ui/Badges";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Form";
import { Pagination } from "@/components/ui/Pagination";
import { EmptyState, ErrorState, Spinner } from "@/components/ui/States";
import { formatDateTime } from "@/lib/format";
import { exportUrl, useAudit } from "@/lib/queries";

export default function AuditPage() {
  return (
    <RequirePerm screen="audit">
      <AuditTrail />
    </RequirePerm>
  );
}

const CATEGORY: Record<AuditCategory, { label: string; tone: "blue" | "green" | "amber" | "gray" | "cyan" }> = {
  signin: { label: "Sign-in", tone: "gray" },
  change: { label: "Change", tone: "blue" },
  decision: { label: "Decision", tone: "green" },
  config: { label: "Configuration", tone: "amber" },
  export: { label: "Export", tone: "cyan" },
};

function AuditTrail() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState(""); // q, applied 300ms after typing stops
  const [role, setRole] = useState<Role | "">("");
  const [category, setCategory] = useState<AuditCategory | "">("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const filters = { q: search || undefined, role: role || undefined, category: category || undefined };
  const audit = useAudit({ ...filters, page, pageSize: 15 });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Every sign-in, decision, configuration change and export, with who did it, when and from where.</p>
      <Card>
        <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_180px_auto]">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search user, action or reference" aria-label="Search" />
          <Select aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value as Role | ""); setPage(1); }}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
          <Select aria-label="Category" value={category} onChange={(e) => { setCategory(e.target.value as AuditCategory | ""); setPage(1); }}>
            <option value="">All categories</option>
            {AUDIT_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY[c].label}</option>)}
          </Select>
          {/* A plain link: the browser downloads the file, sending the session cookie. */}
          <a href={exportUrl("/audit/export.csv", filters)} className={buttonClass("secondary")} download>
            <Download size={15} /> Export CSV
          </a>
        </div>

        {audit.isPending ? <Spinner /> : audit.isError ? <div className="p-4"><ErrorState error={audit.error} /></div> : !audit.data.items.length ? (
          <EmptyState title="No matching events" />
        ) : (
          <div className={`overflow-x-auto ${audit.isPlaceholderData ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase">
                  <th className="px-4 py-2.5">Time</th>
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Action</th>
                  <th className="px-4 py-2.5">Reference</th>
                  <th className="px-4 py-2.5">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {audit.data.items.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink-2">{formatDateTime(a.at)}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-ink">{a.userName}</p>
                      {a.role && <p className="text-xs text-muted">{ROLE_LABELS[a.role]}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="mr-2"><Pill tone={CATEGORY[a.category]?.tone ?? "gray"}>{CATEGORY[a.category]?.label ?? a.category}</Pill></span>
                      <span className="text-ink">{a.action}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {a.ref?.startsWith("CHG-") ? <Link href={`/changes/${a.ref}`} className="font-mono text-xs text-teal hover:underline">{a.ref}</Link> : <Mono>{a.ref ?? "—"}</Mono>}
                    </td>
                    <td className="px-4 py-2.5"><Mono>{a.ip ?? "—"}</Mono></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={audit.data.page} pageSize={audit.data.pageSize} total={audit.data.total} onPage={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
