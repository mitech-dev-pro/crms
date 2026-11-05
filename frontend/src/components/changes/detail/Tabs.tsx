"use client";

import { IMPACT_LABELS, LIKELIHOOD_LABELS, PIR_OUTCOMES, PIR_OUTCOME_LABELS, pirSchema, ROLE_LABELS, type ChangeDetail, type PirInput } from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip } from "lucide-react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Pill } from "@/components/ui/Badges";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Form";
import { EmptyState } from "@/components/ui/States";
import { fileSize, formatDateTime } from "@/lib/format";
import { useMarkImplemented, useReview, useToggleTask } from "@/lib/queries";
import { StepPill } from "./ChangeDetailView";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="mb-1 text-xs font-extrabold tracking-wide text-muted uppercase">{title}</h3>
      <div className="text-sm whitespace-pre-line text-ink">{children}</div>
    </div>
  );
}

export function OverviewTab({ c }: { c: ChangeDetail }) {
  return (
    <>
      <Section title="Summary">{c.summary || "—"}</Section>
      <Section title="Business justification">{c.reason || "—"}</Section>
      <Section title="Systems & areas affected">
        {c.systems.length ? <div className="flex flex-wrap gap-1.5">{c.systems.map((s) => <Pill key={s} tone="blue">{s}</Pill>)}</div> : "—"}
      </Section>
      <Section title="Test plan">{c.testPlan || "—"}</Section>
      <Section title="Rollback plan">{c.rollbackPlan || "—"}</Section>
      <Section title="Attachments">
        {c.attachments.length ? (
          <ul className="space-y-1">
            {c.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-2">
                <Paperclip size={14} className="text-muted" /> <span className="font-semibold">{a.fileName}</span>
                <span className="text-xs text-muted">{fileSize(a.sizeBytes)}</span>
              </li>
            ))}
          </ul>
        ) : (
          "None"
        )}
      </Section>
    </>
  );
}

/** 3×3 impact × likelihood grid with the change's cell marked, like the prototype. */
export function RiskTab({ c }: { c: ChangeDetail }) {
  const tone = (score: number) => (score <= 2 ? "green" : score <= 4 ? "amber" : "red");
  const yesNo = (v: boolean) => (v ? "Yes" : "No");
  return (
    <div className="grid gap-6 md:grid-cols-[auto_1fr]">
      <div>
        <div className="grid grid-cols-[48px_repeat(3,56px)] gap-1 text-xs font-bold">
          {[3, 2, 1].map((l) => (
            <div key={l} className="contents">
              <div className="flex items-center text-muted">{LIKELIHOOD_LABELS[l as 1 | 2 | 3]}</div>
              {[1, 2, 3].map((i) => {
                const score = i * l;
                const on = c.impact === i && c.likelihood === l;
                return (
                  <div
                    key={i}
                    aria-label={on ? `This change: score ${score}` : undefined}
                    className="flex h-14 items-center justify-center rounded-md text-sm"
                    style={{ background: on ? `var(--${tone(score)}-fg)` : `var(--${tone(score)}-bg)`, color: on ? "white" : `var(--${tone(score)}-fg)` }}
                  >
                    {on ? "●" : score}
                  </div>
                );
              })}
            </div>
          ))}
          <div />
          {[1, 2, 3].map((i) => <div key={i} className="text-center text-muted">{IMPACT_LABELS[i as 1 | 2 | 3]}</div>)}
        </div>
        <p className="mt-2 text-xs text-muted">Impact →, Likelihood ↑</p>
      </div>
      <dl className="divide-y divide-line text-sm">
        {[
          ["Score", `${c.score} / 9 (${c.risk})`],
          ["Impact", IMPACT_LABELS[c.impact as 1 | 2 | 3]],
          ["Likelihood", LIKELIHOOD_LABELS[c.likelihood as 1 | 2 | 3]],
          ["Customer-facing", yesNo(c.customerFacing)],
          ["Regulatory / NIC implications", yesNo(c.regulatory)],
          ["Personal data", yesNo(c.personalData)],
          ["Emergency", yesNo(c.emergency)],
          ["Approval route", c.tier],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between py-2">
            <dt className="text-muted">{k}</dt>
            <dd className="font-semibold text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ApprovalsTab({ c }: { c: ChangeDetail }) {
  if (!c.steps.length) return <EmptyState title="Not submitted yet">The approval route is created when the request is submitted.</EmptyState>;
  return (
    <ol className="relative space-y-4 border-l-2 border-line pl-6">
      {c.steps.map((s) => (
        <li key={s.id} className="relative">
          <span
            className={`absolute top-1 -left-[31px] size-3.5 rounded-full border-2 border-surface ${s.status === "pending" ? "animate-stage-pulse" : ""}`}
            style={{ background: dotColor[s.status] }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-extrabold text-ink">
              {s.roleLabel}
              {c.tier === "Emergency" && " (ECAB)"}
            </span>
            <StepPill status={s.status} />
            {s.overridden && <Pill tone="amber">Super admin override</Pill>}
          </div>
          <p className="text-xs text-muted">
            {s.decidedBy ? `${s.decidedBy.name} · ${formatDateTime(s.decidedAt)}` : s.status === "pending" ? "Due within 2 working days" : "—"}
          </p>
          {s.comment && <p className="mt-1 rounded-lg bg-surface-2 px-3 py-2 text-sm text-ink-2">“{s.comment}”</p>}
        </li>
      ))}
    </ol>
  );
}
const dotColor = {
  approved: "var(--green-fg)", pending: "var(--amber-fg)", waiting: "var(--border-strong)",
  rejected: "var(--red-fg)", returned: "var(--pink-fg)", skipped: "var(--border-strong)",
} as const;

export function ImplementationTab({ c }: { c: ChangeDetail }) {
  const toggle = useToggleTask(c.ref);
  const done = useMarkImplemented(c.ref);
  const editable = c.actions.updateTasks;
  const count = c.tasks.filter((t) => t.done).length;

  const hint =
    c.status === "InProgress"
      ? editable ? "Complete every checklist item to mark the change as implemented." : "Only the assigned implementer or the Change Manager can update the checklist."
      : ["Implemented", "Closed"].includes(c.status) ? "Implementation complete." : "The checklist unlocks once the change is approved and implementation has started.";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold text-ink">Checklist · {count}/{c.tasks.length}</p>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-teal" style={{ width: `${c.tasks.length ? (count / c.tasks.length) * 100 : 0}%` }} />
        </div>
      </div>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {c.tasks.map((t) => (
          <li key={t.id}>
            <label className={`flex items-center gap-3 px-3 py-2.5 text-sm ${editable ? "cursor-pointer hover:bg-surface-2" : "opacity-80"}`}>
              <input
                type="checkbox"
                checked={t.done}
                disabled={!editable || toggle.isPending}
                onChange={(e) => toggle.mutate({ taskId: t.id, done: e.target.checked })}
                className="size-4 accent-[var(--teal)]"
              />
              <span className={t.done ? "text-muted line-through" : "text-ink"}>{t.label}</span>
              {t.doneBy && <span className="ml-auto text-xs text-faint">{t.doneBy.name}</span>}
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{hint}</p>
      {(toggle.error || done.error) && <p className="mt-1 text-xs font-semibold text-danger">{(toggle.error ?? done.error)!.message}</p>}
      {c.actions.markImplemented && (
        <Button className="mt-3" loading={done.isPending} onClick={() => done.mutate()}>Mark as implemented</Button>
      )}
    </div>
  );
}

export function PirTab({ c }: { c: ChangeDetail }) {
  if (c.pir) {
    return (
      <div className="space-y-3 text-sm">
        <Pill tone={c.pir.outcome.startsWith("Successful") ? "green" : "red"}>{PIR_OUTCOME_LABELS[c.pir.outcome]}</Pill>
        <p className="whitespace-pre-line text-ink">{c.pir.notes}</p>
        <p className="text-xs text-muted">
          Reviewed by {c.pir.reviewedBy.name} · {formatDateTime(c.pir.reviewedAt)}
        </p>
      </div>
    );
  }
  if (c.actions.review) return <PirForm c={c} />;
  return (
    <EmptyState title="No review yet">
      {c.status === "Implemented" ? `Awaiting post-implementation review by the ${ROLE_LABELS.changeManager}.` : "The review opens after the change has been implemented."}
    </EmptyState>
  );
}

function PirForm({ c }: { c: ChangeDetail }) {
  const review = useReview(c.ref);
  const { register, handleSubmit, formState: { errors } } = useForm<PirInput>({ resolver: zodResolver(pirSchema), defaultValues: { outcome: "Successful", notes: "" } });
  return (
    <form onSubmit={handleSubmit((v) => review.mutate(v))} className="max-w-lg space-y-4">
      <Field label="Outcome" htmlFor="outcome">
        <Select id="outcome" {...register("outcome")}>
          {PIR_OUTCOMES.map((o) => <option key={o} value={o}>{PIR_OUTCOME_LABELS[o]}</option>)}
        </Select>
      </Field>
      <Field label="Review notes" htmlFor="notes" error={errors.notes?.message}>
        <Textarea id="notes" rows={4} invalid={!!errors.notes} placeholder="What happened, any issues, lessons learned" {...register("notes")} />
      </Field>
      {review.error && <p className="text-xs font-semibold text-danger">{review.error.message}</p>}
      <Button type="submit" loading={review.isPending}>Complete review & close</Button>
    </form>
  );
}

export function ActivityTab({ c }: { c: ChangeDetail }) {
  if (!c.activity.length) return <EmptyState title="No activity yet" />;
  return (
    <ul className="divide-y divide-line">
      {c.activity.map((a) => (
        <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
          <span>
            <b className="text-ink">{a.userName}</b> <span className="text-ink-2">{a.action}</span>
            {a.role && <span className="ml-1 text-xs text-muted">· {ROLE_LABELS[a.role]}</span>}
          </span>
          <span className="text-xs text-muted">{formatDateTime(a.at)}</span>
        </li>
      ))}
    </ul>
  );
}
