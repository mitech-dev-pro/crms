"use client";

import { workingDaysBetween, type CurrentStage } from "@crms/shared";
import { AlarmClock, Clock } from "lucide-react";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** When the current stage's decision is due, and whether it's late (2 working days per stage). */
export function dueState(stage: CurrentStage, now = Date.now()) {
  if (!stage?.dueAt) return null;
  const due = new Date(stage.dueAt);
  if (due.getTime() > now) return { overdue: false, text: `Due ${dayLabel(stage.dueAt)}`, title: `Decision due by ${formatDateTime(stage.dueAt)}` };
  const late = workingDaysBetween(due, new Date(now));
  return {
    overdue: true,
    text: late < 1 ? "Due today" : `Overdue by ${late} working day${late === 1 ? "" : "s"}`,
    title: `Decision was due by ${formatDateTime(stage.dueAt)}`,
  };
}

/** A small pill: "Due Tue 10 Nov", or red "Overdue by 2 working days". */
export default function DueBadge({ stage }: { stage: CurrentStage }) {
  const [now] = useState(() => Date.now()); // read the clock once per mount; rendering stays pure
  const s = dueState(stage, now);
  if (!s) return null;
  const Icon = s.overdue ? AlarmClock : Clock;
  return (
    <span
      title={s.title}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap"
      style={{ background: `var(--${s.overdue ? "red" : "gray"}-bg)`, color: `var(--${s.overdue ? "red" : "gray"}-fg)` }}
    >
      <Icon size={11} aria-hidden /> {s.text}
    </span>
  );
}
