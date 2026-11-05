"use client";

import type { ChangeDetail, DecisionInput } from "@crms/shared";
import { AlertTriangle, Info } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Checkbox, Textarea } from "@/components/ui/Form";
import { ApiError } from "@/lib/api";
import { useDecision, useStartChange, useSubmitChange } from "@/lib/queries";

/**
 * The "what can I do now?" box under the lifecycle bar.
 * Which panel shows is decided by the server's `actions` flags, never by the UI guessing.
 */
export default function ActionPanel({ change: c, onShowTab }: { change: ChangeDetail; onShowTab: (t: "impl") => void }) {
  const a = c.actions;
  const stage = c.currentStage?.label;

  if (a.decide || a.override) return <DecisionPanel change={c} override={!a.decide && a.override} />;
  if (a.submit) return <SubmitPanel change={c} />;
  if (a.start) return <StartPanel change={c} onShowTab={onShowTab} />;

  if (a.sodBlocked) {
    return (
      <Notice tone="amber" icon={<AlertTriangle size={16} />}>
        You raised this change, so you can&apos;t approve it at the <b>{stage}</b> stage (segregation of duties). Another person holding that role, such as a deputy, can decide it.
      </Notice>
    );
  }
  if (c.status === "PendingApproval" && stage) {
    return (
      <Notice tone="gray" icon={<Info size={16} />}>
        Read-only · this request is waiting at the <b>{stage}</b> stage. Only users holding that role can act on it.
      </Notice>
    );
  }
  return null;
}

function DecisionPanel({ change: c, override }: { change: ChangeDetail; override: boolean }) {
  const decision = useDecision(c.ref);
  const [comment, setComment] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const decide = (kind: DecisionInput["kind"]) => {
    // Same rules as the server, checked first for a quicker message. The server checks again.
    if ((kind !== "approve" || override) && !comment.trim()) {
      setLocalError(override ? "A reason is required for an override." : `A comment is required to ${kind === "reject" ? "reject" : "request rework"}.`);
      return;
    }
    setLocalError(null);
    decision.mutate({ kind, comment: comment.trim() || undefined } as DecisionInput, { onSuccess: () => setComment("") });
  };

  const apiError = decision.error instanceof ApiError ? decision.error.fields.comment ?? decision.error.message : null;
  const error = localError ?? apiError;

  return (
    <section className={`rounded-xl border-2 bg-surface p-4 ${override ? "border-[var(--amber-fg)]/60" : "border-teal-bright"}`}>
      <h3 className="text-sm font-extrabold text-ink">
        {override ? `Break-glass override · ${c.currentStage?.label} stage` : `Your decision is required · ${c.currentStage?.label} review`}
      </h3>
      {override && (
        <p className="mt-1 text-sm" style={{ color: "var(--amber-fg)" }}>
          The requester holds the only approving role for this stage. As super admin you may decide it. Your reason is mandatory and the decision is flagged as an override in the audit trail.
        </p>
      )}
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={override ? "Reason for the override (required)" : "Add a comment (required to reject or request rework)"}
        aria-label="Decision comment"
        invalid={!!error}
        className="mt-3"
      />
      {error && <p className="mt-1 text-xs font-semibold text-danger">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => decide("approve")} loading={decision.isPending && decision.variables?.kind === "approve"} disabled={decision.isPending}>
          {override ? "Approve (override)" : "Approve"}
        </Button>
        <Button variant="secondary" onClick={() => decide("return")} disabled={decision.isPending}>Request rework</Button>
        <Button variant="danger" onClick={() => decide("reject")} disabled={decision.isPending}>Reject</Button>
      </div>
    </section>
  );
}

function SubmitPanel({ change: c }: { change: ChangeDetail }) {
  const submit = useSubmitChange(c.ref);
  const [attest, setAttest] = useState(false);
  const fields = submit.error instanceof ApiError ? Object.values(submit.error.fields) : [];
  const returned = c.status === "ReturnedForRework";

  return (
    <section className="rounded-xl border-2 border-teal-bright bg-surface p-4">
      <h3 className="text-sm font-extrabold text-ink">{returned ? "Returned for rework" : "Draft · not yet submitted"}</h3>
      <p className="mt-1 text-sm text-muted">
        {returned ? "Update the request using the reviewer's comments (see Approvals), then resubmit. It starts a fresh approval route." : "Complete the request, then submit it for approval."}
      </p>
      <div className="mt-3">
        <Checkbox checked={attest} onChange={(e) => setAttest(e.target.checked)} label="I confirm the information is accurate and the rollback plan has been reviewed." />
      </div>
      {submit.error && (
        <div role="alert" className="mt-2 text-xs font-semibold text-danger">
          {submit.error.message}
          {fields.length > 0 && <ul className="mt-1 list-disc pl-5">{fields.map((f) => <li key={f}>{f}</li>)}</ul>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => submit.mutate()} disabled={!attest} loading={submit.isPending}>{returned ? "Resubmit for approval" : "Submit for approval"}</Button>
        <ButtonLink href={`/changes/new?edit=${c.ref}`} variant="secondary">Edit request</ButtonLink>
      </div>
    </section>
  );
}

function StartPanel({ change: c, onShowTab }: { change: ChangeDetail; onShowTab: (t: "impl") => void }) {
  const start = useStartChange(c.ref);
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-teal-bright bg-surface p-4">
      <div>
        <h3 className="text-sm font-extrabold text-ink">Approved and ready to implement</h3>
        <p className="text-sm text-muted">Starting unlocks the implementation checklist.</p>
        {start.error && <p className="mt-1 text-xs font-semibold text-danger">{start.error.message}</p>}
      </div>
      <Button loading={start.isPending} onClick={() => start.mutate(undefined, { onSuccess: () => onShowTab("impl") })}>Start implementation</Button>
    </section>
  );
}

function Notice({ tone, icon, children }: { tone: "amber" | "gray"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: `var(--${tone}-bg)`, color: `var(--${tone}-fg)` }}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}
