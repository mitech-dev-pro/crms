"use client";

import { RISK_TIERS, ROLE_LABELS, type RiskTier } from "@crms/shared";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { RequirePerm } from "@/components/layout/SessionGate";
import { Pill } from "@/components/ui/Badges";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Form";
import { ErrorState, Spinner } from "@/components/ui/States";
import { useWorkflows } from "@/lib/queries";

export default function FlowsPage() {
  return (
    <RequirePerm screen="flows">
      <Flows />
    </RequirePerm>
  );
}

const LIFECYCLE = [
  ["Draft", "Requester"],
  ["Pending approval", "Approvers, stage by stage"],
  ["Scheduled", "Change Manager"],
  ["In progress", "Implementer"],
  ["Implemented", "Implementer"],
  ["Post-review", "Change Manager"],
  ["Closed", "Change Manager"],
] as const;

const TIER_INFO: Record<RiskTier, { tone: "green" | "amber" | "red" | "pink"; note: string }> = {
  Low: { tone: "green", note: "Score 1–2" },
  Medium: { tone: "amber", note: "Score 3–4" },
  High: { tone: "red", note: "Score 6–9" },
  Emergency: { tone: "pink", note: "Service down or security" },
};

function Flows() {
  const wf = useWorkflows();
  const [dept, setDept] = useState(""); // "" = company default

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-base font-extrabold text-ink">Change lifecycle</h2>
        <p className="mt-1 text-sm text-muted">Every request moves through these states. Each transition is permission-checked and written to the audit trail.</p>
        <ol className="mt-4 flex flex-wrap items-center gap-2">
          {LIFECYCLE.map(([state, who], i) => (
            <li key={state} className="flex items-center gap-2">
              <div className="rounded-lg border border-line bg-surface-2 px-3 py-2">
                <p className="text-sm font-extrabold text-ink">{state}</p>
                <p className="text-xs text-muted">{who}</p>
              </div>
              {i < LIFECYCLE.length - 1 && <ArrowRight size={16} className="text-faint" aria-hidden />}
            </li>
          ))}
        </ol>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Note tone="red" title="Rejected">Any approver can reject with a comment. Remaining stages are skipped and the request is closed.</Note>
          <Note tone="pink" title="Returned for rework">Goes back to the requester. Resubmitting restarts the approval route from stage 1.</Note>
          <Note tone="amber" title="Emergency">Goes straight to the Change Manager and Emergency CAB. A post-implementation review is required within 5 days.</Note>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-ink">Approval routes</h2>
            <p className="mt-1 text-sm text-muted">
              Live from Administration → Approval workflows. Risk tier = impact × likelihood. Changes dated inside a freeze window also get an Executive stage.
            </p>
          </div>
          <div className="w-full sm:w-60">
            <Select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments (default)</option>
              {wf.data?.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
        </div>

        {wf.isPending ? <Spinner /> : wf.isError ? <ErrorState error={wf.error} /> : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {RISK_TIERS.map((tier) => {
              const custom = dept ? wf.data.overrides[dept]?.[tier] : undefined;
              const route = custom ?? wf.data.default[tier];
              const { tone, note } = TIER_INFO[tier];
              return (
                <div key={tier} className="overflow-hidden rounded-xl border border-line">
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: `var(--${tone}-bg)`, color: `var(--${tone}-fg)` }}>
                    <span className="font-extrabold">{tier}</span>
                    <span className="text-xs font-bold">{note}</span>
                  </div>
                  <ol className="space-y-2 p-4">
                    {route.map((role, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-ink">
                        <span className="flex size-5 items-center justify-center rounded-full bg-navy text-[11px] font-extrabold text-white">{i + 1}</span>
                        {ROLE_LABELS[role]}
                        {tier === "Emergency" && <span className="text-xs text-muted">(ECAB)</span>}
                      </li>
                    ))}
                  </ol>
                  {dept && <div className="px-4 pb-3">{custom ? <Pill tone="blue">Custom route</Pill> : <Pill tone="gray">Uses default</Pill>}</div>}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Note({ tone, title, children }: { tone: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-3 py-2 text-sm" style={{ background: `var(--${tone}-bg)`, color: `var(--${tone}-fg)`, borderColor: `var(--${tone}-fg)` }}>
      <b>{title}</b>: {children}
    </div>
  );
}
