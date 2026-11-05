"use client";

import { APPROVER_ROLES, RISK_TIERS, ROLE_LABELS, isApproverRole, type RiskTier, type Role } from "@crms/shared";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { useState } from "react";
import { Pill } from "@/components/ui/Badges";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { ErrorState, Spinner } from "@/components/ui/States";
import { useUpdateWorkflow } from "@/lib/admin-queries";
import { useWorkflows } from "@/lib/queries";

export default function WorkflowsTab() {
  const wf = useWorkflows();
  const [dept, setDept] = useState<string | null>(null); // null = company default
  const [tier, setTier] = useState<RiskTier>("High");

  if (wf.isPending) return <Spinner />;
  if (wf.isError) return <ErrorState error={wf.error} />;

  const override = dept ? wf.data.overrides[dept]?.[tier] : undefined;
  const saved = dept ? override : wf.data.default[tier];
  const deptName = dept ? wf.data.departments.find((d) => d.id === dept)?.name : "All departments (default)";

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Card className="p-2">
        <ul aria-label="Departments">
          {[{ id: null, name: "All departments (default)", note: "Applies unless overridden" }, ...wf.data.departments.map((d) => ({
            id: d.id as string | null, name: d.name, note: wf.data.overrides[d.id] ? "Custom route" : "Uses default",
          }))].map((d) => (
            <li key={d.id ?? "default"}>
              <button
                onClick={() => setDept(d.id)}
                aria-current={dept === d.id ? "true" : undefined}
                className={`w-full rounded-lg px-3 py-2 text-left ${dept === d.id ? "bg-teal-tint" : "hover:bg-surface-2"}`}
              >
                <span className={`block text-sm ${dept === d.id ? "font-extrabold text-teal-strong" : "font-bold text-ink"}`}>{d.name}</span>
                <span className="block text-xs text-muted">{d.note}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-ink">{deptName}</h2>
          <div className="flex gap-1" role="group" aria-label="Risk tier">
            {RISK_TIERS.map((t) => (
              <button key={t} onClick={() => setTier(t)} aria-pressed={tier === t} className={`rounded-full border px-3 py-1 text-xs font-bold ${tier === t ? "border-navy bg-navy text-white" : "border-line-strong text-ink-2 hover:bg-surface-2"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {/* key: start fresh whenever the department or tier changes */}
        <RouteEditor key={`${dept}-${tier}`} departmentId={dept} tier={tier} saved={saved} fallback={wf.data.default[tier]} />
      </Card>
    </div>
  );
}

function RouteEditor({ departmentId, tier, saved, fallback }: { departmentId: string | null; tier: RiskTier; saved?: Role[]; fallback: Role[] }) {
  const update = useUpdateWorkflow();
  const usesDefault = departmentId !== null && !saved;
  const [stages, setStages] = useState<Role[]>(saved ?? fallback);
  const [editing, setEditing] = useState(!usesDefault);
  const [toAdd, setToAdd] = useState<Role | "">("");
  const dirty = JSON.stringify(stages) !== JSON.stringify(saved ?? fallback) || (usesDefault && editing);
  const available = APPROVER_ROLES.filter((r) => !stages.includes(r));

  const move = (i: number, by: -1 | 1) =>
    setStages((s) => {
      const next = [...s];
      [next[i], next[i + by]] = [next[i + by]!, next[i]!];
      return next;
    });

  if (!editing) {
    return (
      <div>
        <p className="mb-3 text-sm text-muted">This department uses the company default for {tier} changes:</p>
        <StageList stages={fallback} />
        <Button variant="secondary" className="mt-3" onClick={() => setEditing(true)}>Customise for this department</Button>
      </div>
    );
  }

  return (
    <div>
      {tier === "Emergency" && <p className="mb-3 text-xs text-muted">Emergency changes skip the freeze rule. Keep this route short.</p>}
      <ol className="space-y-2">
        {stages.map((role, i) => (
          <li key={role} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-navy text-xs font-extrabold text-white">{i + 1}</span>
            <span className="flex-1 text-sm font-bold text-ink">{ROLE_LABELS[role]}</span>
            <IconButton label={`Move ${ROLE_LABELS[role]} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></IconButton>
            <IconButton label={`Move ${ROLE_LABELS[role]} down`} disabled={i === stages.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></IconButton>
            <IconButton label={`Remove ${ROLE_LABELS[role]}`} disabled={departmentId === null && stages.length === 1} onClick={() => setStages((s) => s.filter((r) => r !== role))}><X size={14} /></IconButton>
          </li>
        ))}
        {!stages.length && <li className="rounded-lg border border-dashed border-line px-3 py-3 text-sm text-muted">No stages. Saving resets this department to the default route.</li>}
      </ol>

      {available.length > 0 && (
        <div className="mt-3 flex gap-2">
          <div className="w-52">
            <Select aria-label="Stage to add" value={toAdd} onChange={(e) => setToAdd(e.target.value as Role | "")}>
              <option value="">Choose a role…</option>
              {available.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </Select>
          </div>
          <Button variant="secondary" disabled={!toAdd} onClick={() => { if (toAdd) setStages((s) => [...s, toAdd]); setToAdd(""); }}>Add stage</Button>
        </div>
      )}

      {update.error && <p className="mt-3 text-xs font-semibold text-danger">{update.error.message}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Button
          disabled={!dirty}
          loading={update.isPending}
          // Saving no stages for a department is the same as resetting it to the default.
          onClick={() => update.mutate({ departmentId, tier, roles: stages.filter(isApproverRole) }, { onSuccess: () => { if (!stages.length) { setStages(fallback); setEditing(false); } } })}
        >
          Save route
        </Button>
        {departmentId !== null && !usesDefault && (
          <Button
            variant="ghost"
            onClick={() =>
              confirm("Reset this department to the company default route for this tier?") &&
              update.mutate({ departmentId, tier, roles: [] }, { onSuccess: () => { setStages(fallback); setEditing(false); } })
            }
          >
            Reset to default
          </Button>
        )}
        {dirty && <Pill tone="amber">Unsaved changes</Pill>}
        {update.isSuccess && !dirty && <span className="text-xs font-semibold" style={{ color: "var(--green-fg)" }}>Saved. New submissions use this route.</span>}
      </div>
      <p className="mt-2 text-xs text-muted">Changes already in approval keep the route they were submitted with.</p>
    </div>
  );
}

function StageList({ stages }: { stages: Role[] }) {
  return (
    <ol className="space-y-2">
      {stages.map((r, i) => (
        <li key={r} className="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-bold text-ink">
          <span className="flex size-6 items-center justify-center rounded-full bg-navy text-xs font-extrabold text-white">{i + 1}</span>
          {ROLE_LABELS[r]}
        </li>
      ))}
    </ol>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} title={label} disabled={disabled} onClick={onClick} className="rounded border border-line p-1 text-ink-2 hover:bg-surface-2 disabled:opacity-30">
      {children}
    </button>
  );
}
