"use client";

import { ROLE_LABELS, isApproverRole, standInSchema, type StandInDto, type StandInInput } from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Pill } from "@/components/ui/Badges";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Combobox } from "@/components/ui/Combobox";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Field, Input } from "@/components/ui/Form";
import { EmptyState, TableSkeleton } from "@/components/ui/States";
import { ApiError } from "@/lib/api";
import { ymd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { useCreateStandIn, useEndStandIn, useMe, useStandInCandidates, useStandIns } from "@/lib/queries";

const STATE_TONE = { active: "green", upcoming: "blue", ended: "gray" } as const;
const STATE_LABEL = { active: "Active now", upcoming: "Upcoming", ended: "Ended" } as const;

/**
 * Stand-ins for approvers on leave.
 * scope "mine": cover for yourself (My approvals). scope "all": anyone's (Administration, Change Manager).
 */
export default function StandInsPanel({ scope }: { scope: "mine" | "all" }) {
  const { data: me } = useMe();
  const list = useStandIns(scope);
  const end = useEndStandIn();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  if (!me) return null;
  const canArrangeOwn = isApproverRole(me.role);
  const manager = scope === "all";

  const items = list.data?.items ?? [];
  const canEnd = (s: StandInDto) => s.state !== "ended" && (manager || s.from.id === me.id || s.createdBy.id === me.id);

  return (
    <Card>
      <CardHeader
        title={manager ? "Stand-ins" : "Away? Arrange a stand-in"}
        right={!adding && (manager || canArrangeOwn) ? <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setAdding(true)}>Arrange a stand-in</Button> : undefined}
      />
      <p className="border-b border-line px-4 py-3 text-sm text-muted">
        While someone is away, their stand-in can decide that person&apos;s approval stages. Decisions are recorded as made on their behalf,
        and a stand-in can never decide a change the absent approver raised.
      </p>

      {adding && <StandInForm manager={manager} onDone={() => setAdding(false)} />}

      {list.isPending ? (
        <TableSkeleton rows={2} cols={3} />
      ) : !items.length ? (
        <EmptyState title="No stand-ins arranged">{manager ? "None in the last 90 days." : "Arrange one before you go on leave, so changes don't wait for you."}</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((s) => (
            <li key={s.id} className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${s.state === "ended" ? "opacity-60" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm text-ink">
                  <b>{s.to.id === me.id ? "You" : s.to.name}</b>
                  <span className="text-muted">{s.to.id === me.id ? "cover" : "covers"}</span>
                  <b>{s.from.id === me.id ? "you" : s.from.name}</b>
                  <span className="text-xs text-muted">({ROLE_LABELS[s.from.role]})</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDate(s.startsOn)} <ArrowRight size={11} className="inline" aria-label="to" /> {formatDate(s.endsOn)}
                  {s.reason && <> · {s.reason}</>}
                  {manager && <> · arranged by {s.createdBy.name}</>}
                </p>
              </div>
              <Pill tone={STATE_TONE[s.state]}>{STATE_LABEL[s.state]}</Pill>
              {canEnd(s) && (
                <Button
                  variant="danger"
                  className="px-3 py-1 text-xs"
                  onClick={async () => {
                    const ok = await confirm({
                      title: `End ${s.to.name}'s stand-in?`,
                      message: `${s.to.name} will stop deciding ${ROLE_LABELS[s.from.role]} stages for ${s.from.name} straight away.`,
                      confirmLabel: "End stand-in",
                      tone: "danger",
                    });
                    if (ok) end.mutate(s.id);
                  }}
                >
                  End now
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StandInForm({ manager, onDone }: { manager: boolean; onDone: () => void }) {
  const { data: me } = useMe();
  const candidates = useStandInCandidates();
  const create = useCreateStandIn();
  const [today] = useState(() => ymd(new Date()));
  const { register, handleSubmit, control, setError, formState: { errors } } = useForm<StandInInput>({
    resolver: zodResolver(standInSchema),
    defaultValues: { startsOn: today },
  });
  const [fromUserId, startsOn] = useWatch({ control, name: ["fromUserId", "startsOn"] });
  const absent = manager ? fromUserId : me?.id;
  const people = candidates.data?.items ?? [];
  const option = (p: (typeof people)[number]) => ({ value: p.id, label: p.name, hint: `${ROLE_LABELS[p.role]} · ${p.department}` });

  const save = handleSubmit((v) =>
    create.mutate(v, {
      onSuccess: onDone,
      onError: (e) => {
        if (e instanceof ApiError && Object.keys(e.fields).length) {
          for (const [k, m] of Object.entries(e.fields)) setError(k as keyof StandInInput, { message: m });
        } else setError("root", { message: e.message });
      },
    }),
  );

  return (
    <form onSubmit={save} noValidate className="grid gap-3 border-b border-line bg-surface-2 p-4 md:grid-cols-2">
      {manager && (
        <Field label="Who is away" htmlFor="si-from" error={errors.fromUserId?.message}>
          <Controller name="fromUserId" control={control} render={({ field }) => (
            <Combobox id="si-from" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.fromUserId} placeholder="Search approvers"
              options={people.filter((p) => isApproverRole(p.role)).map(option)} />
          )} />
        </Field>
      )}
      <Field label="Stand-in" htmlFor="si-to" error={errors.toUserId?.message}>
        <Controller name="toUserId" control={control} render={({ field }) => (
          <Combobox id="si-to" value={field.value} onChange={(v) => field.onChange(v ?? "")} onBlur={field.onBlur} invalid={!!errors.toUserId} placeholder="Search people who approve changes"
            options={people.filter((p) => p.id !== absent).map(option)} />
        )} />
      </Field>
      <Field label="From" htmlFor="si-start" error={errors.startsOn?.message}>
        <Controller name="startsOn" control={control} render={({ field }) => (
          <DatePicker id="si-start" value={field.value} onChange={(v) => field.onChange(v ?? "")} onBlur={field.onBlur} min={today} invalid={!!errors.startsOn} />
        )} />
      </Field>
      <Field label="Until (inclusive)" htmlFor="si-end" error={errors.endsOn?.message}>
        <Controller name="endsOn" control={control} render={({ field }) => (
          <DatePicker id="si-end" value={field.value} onChange={(v) => field.onChange(v ?? "")} onBlur={field.onBlur} min={startsOn || today} invalid={!!errors.endsOn} />
        )} />
      </Field>
      <Field label="Reason (optional)" htmlFor="si-reason" hint="e.g. Annual leave. The stand-in sees this.">
        <Input id="si-reason" maxLength={300} {...register("reason")} />
      </Field>
      <div className="flex flex-wrap items-end gap-2 md:col-span-2">
        <Button type="submit" loading={create.isPending}><UserRoundCheck size={15} /> Arrange stand-in</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
        {errors.root && <p role="alert" className="text-xs font-semibold text-danger">{errors.root.message}</p>}
      </div>
    </form>
  );
}
