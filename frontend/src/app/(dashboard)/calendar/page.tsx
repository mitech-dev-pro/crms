"use client";

import { FREEZE_MANAGERS, freezeSchema, type ChangeListItem, type ChangeStatus, type FreezeInput } from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { RequirePerm } from "@/components/layout/SessionGate";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { Field, Input } from "@/components/ui/Form";
import { ErrorState } from "@/components/ui/States";
import { monthGrid, ymd } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { useCalendar, useCreateFreeze, useDeleteFreeze, useFreezes, useMe } from "@/lib/queries";

export default function CalendarPage() {
  return (
    <RequirePerm screen="calendar">
      <CalendarView />
    </RequirePerm>
  );
}

// Chip colours follow the prototype's legend.
const chipTone: Partial<Record<ChangeStatus, string>> = {
  Scheduled: "blue", Approved: "blue", InProgress: "cyan", PendingApproval: "amber", ReturnedForRework: "pink", Implemented: "green", Closed: "green",
};
const LEGEND = [["blue", "Scheduled"], ["cyan", "In progress"], ["amber", "Pending approval"], ["green", "Implemented / closed"]] as const;
const hatch = "repeating-linear-gradient(135deg, var(--amber-bg) 0 6px, transparent 6px 12px)";

function CalendarView() {
  const [{ year, month }, setYm] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [today] = useState(() => ymd(new Date()));
  const days = useMemo(() => monthGrid(year, month), [year, month]);
  const from = ymd(days[0]!), to = ymd(days.at(-1)!);
  const cal = useCalendar(from, to);

  const byDay = useMemo(() => {
    const map = new Map<string, ChangeListItem[]>();
    for (const c of cal.data?.items ?? []) if (c.plannedDate) map.set(c.plannedDate, [...(map.get(c.plannedDate) ?? []), c]);
    return map;
  }, [cal.data]);
  const freezeOn = (d: string) => cal.data?.freezes.find((f) => d >= f.from && d <= f.to);
  const step = (n: number) => setYm(({ year: y, month: m }) => ({ year: new Date(y, m + n, 1).getFullYear(), month: new Date(y, m + n, 1).getMonth() }));
  const title = new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <button onClick={() => step(-1)} aria-label="Previous month" className="rounded-lg border border-line-strong p-1.5 hover:bg-surface-2"><ChevronLeft size={16} /></button>
          <button onClick={() => step(1)} aria-label="Next month" className="rounded-lg border border-line-strong p-1.5 hover:bg-surface-2"><ChevronRight size={16} /></button>
          <h2 className="ml-1 text-base font-extrabold text-ink" aria-live="polite">{title}</h2>
          {cal.isFetching && <span className="ml-auto text-xs text-muted">Loading…</span>}
        </div>
        {cal.isError ? <div className="p-4"><ErrorState error={cal.error} /></div> : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[700px] grid-cols-7" role="grid" aria-label={title}>
              {/* role="row" with display: contents keeps the CSS grid while giving screen readers rows. */}
              <div role="row" className="contents">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d} role="columnheader" className="border-b border-line px-2 py-2 text-xs font-bold tracking-wide text-muted uppercase">{d}</div>
                ))}
              </div>
              {Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7)).map((week) => (
              <div role="row" className="contents" key={ymd(week[0]!)}>
              {week.map((d) => {
                const key = ymd(d);
                const inMonth = d.getMonth() === month;
                const freeze = freezeOn(key);
                const items = byDay.get(key) ?? [];
                return (
                  <div
                    key={key}
                    role="gridcell"
                    className={`min-h-24 border-r border-b border-line p-1.5 last:border-r-0 ${inMonth ? "" : "bg-surface-2"}`}
                    style={freeze ? { backgroundImage: hatch } : undefined}
                    title={freeze ? `${freeze.name} (${formatDate(freeze.from)} – ${formatDate(freeze.to)})` : undefined}
                  >
                    <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${key === today ? "bg-navy text-white" : inMonth ? "text-ink" : "text-faint"}`}>
                      <span aria-hidden>{d.getDate()}</span>
                      <span className="sr-only">
                        {formatDate(key)}{freeze ? `, ${freeze.name} freeze` : ""}, {items.length ? `${items.length} change${items.length === 1 ? "" : "s"}` : "no changes"}
                      </span>
                    </span>
                    <ul className="mt-1 space-y-1">
                      {items.slice(0, 3).map((c) => (
                        <li key={c.id}>
                          <Link
                            href={`/changes/${c.ref}`}
                            title={`${c.ref} · ${c.title} · ${c.window ?? ""}`}
                            className="block truncate rounded px-1.5 py-0.5 text-[11px] font-bold hover:opacity-80"
                            style={{ background: `var(--${chipTone[c.status] ?? "gray"}-bg)`, color: `var(--${chipTone[c.status] ?? "gray"}-fg)` }}
                          >
                            {c.ref.slice(-4)} {c.title}
                          </Link>
                        </li>
                      ))}
                      {items.length > 3 && <li className="px-1.5 text-[11px] font-semibold text-muted">+{items.length - 3} more</li>}
                    </ul>
                  </div>
                );
              })}
              </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <FreezePanel />
        <Card>
          <CardHeader title="Legend" />
          <ul className="space-y-2 p-4 text-sm text-ink-2">
            {LEGEND.map(([tone, label]) => (
              <li key={label} className="flex items-center gap-2">
                <span className="size-3 rounded-sm" style={{ background: `var(--${tone}-fg)` }} /> {label}
              </li>
            ))}
            <li className="flex items-center gap-2">
              <span className="size-3 rounded-sm border border-line" style={{ backgroundImage: hatch }} /> Freeze window
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function FreezePanel() {
  const { data: me } = useMe();
  const freezes = useFreezes();
  const remove = useDeleteFreeze();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);
  const canManage = !!me && FREEZE_MANAGERS.includes(me.role);
  const [today] = useState(() => ymd(new Date()));
  const upcoming = (freezes.data?.items ?? []).filter((f) => f.to >= today);

  return (
    <Card>
      <CardHeader title="Freeze windows" />
      <ul className="divide-y divide-line">
        {upcoming.map((f) => (
          <li key={f.id} className="flex items-start justify-between gap-2 px-4 py-2.5">
            <div className="border-l-2 pl-2" style={{ borderColor: "var(--amber-fg)" }}>
              <p className="text-sm font-bold text-ink">{f.name}</p>
              <p className="text-xs text-muted">{formatDate(f.from)} – {formatDate(f.to)}</p>
            </div>
            {canManage && (
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: `Remove the "${f.name}" freeze?`,
                    message: `${formatDate(f.from)} – ${formatDate(f.to)} will no longer add an Executive approval stage to new changes.`,
                    confirmLabel: "Remove freeze",
                    tone: "danger",
                  });
                  if (ok) remove.mutate(f.id);
                }}
                aria-label={`Remove ${f.name}`}
                className="rounded p-1 text-muted hover:bg-[var(--red-bg)] hover:text-danger"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
        {!upcoming.length && <li className="px-4 py-3 text-sm text-muted">No upcoming freeze windows.</li>}
      </ul>
      {canManage && (
        <div className="border-t border-line p-4">
          {adding ? <FreezeForm onDone={() => setAdding(false)} /> : <Button variant="secondary" className="w-full" onClick={() => setAdding(true)}>Add freeze window</Button>}
        </div>
      )}
    </Card>
  );
}

function FreezeForm({ onDone }: { onDone: () => void }) {
  const create = useCreateFreeze();
  const freezes = useFreezes();
  const { register, handleSubmit, control, formState: { errors } } = useForm<FreezeInput>({ resolver: zodResolver(freezeSchema) });
  const from = useWatch({ control, name: "from" });
  const markers = (freezes.data?.items ?? []).map((f) => ({ from: f.from, to: f.to, label: `${f.name} freeze` }));
  // Existing freezes are shaded so overlaps are easy to spot; "To" can't be before "From".
  const picker = (name: "from" | "to", min?: string) => (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <DatePicker
          id={`fz-${name}`}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          min={min}
          invalid={!!errors[name]}
          markers={markers}
          markerLegend="Existing freeze"
        />
      )}
    />
  );
  return (
    <form onSubmit={handleSubmit((v) => create.mutate(v, { onSuccess: onDone }))} noValidate className="space-y-3">
      <Field label="Name" htmlFor="fz-name" error={errors.name?.message}>
        <Input id="fz-name" placeholder="e.g. Quarter-end close" invalid={!!errors.name} {...register("name")} />
      </Field>
      <div className="grid gap-3">
        <Field label="From" htmlFor="fz-from" error={errors.from?.message}>
          {picker("from")}
        </Field>
        <Field label="To" htmlFor="fz-to" error={errors.to?.message}>
          {picker("to", from)}
        </Field>
      </div>
      <p className="text-xs text-muted">Non-emergency changes dated inside a freeze get an Executive approval stage.</p>
      {create.error && <p className="text-xs font-semibold text-danger">{create.error.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" loading={create.isPending}>Add</Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

