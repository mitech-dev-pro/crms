"use client";

import { Moon } from "lucide-react";
import { useState } from "react";
import { Combobox, type ComboOption } from "./Combobox";
import { Input } from "./Form";

/** Every 15 minutes. Searchable as "20:30", "2030", "8:30pm" or "8:30 pm". */
const TIMES: ComboOption[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4), m = (i % 4) * 15;
  const hh = String(h).padStart(2, "0"), mm = String(m).padStart(2, "0");
  const h12 = h % 12 || 12, ampm = h < 12 ? "am" : "pm";
  return { value: `${hh}:${mm}`, label: `${hh}:${mm}`, keywords: `${hh}${mm} ${h12}:${mm}${ampm} ${h12}:${mm} ${ampm} ${h12}${ampm}` };
});

const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const pad = (t: string) => (t.length === 4 ? `0${t}` : t); // "8:00" → "08:00"

/** Reads "20:00–23:00", "22:00–02:00 (+1 day)" or "Sat 20:00 – Sun 06:00". Anything else is a free-text note. */
export function parseWindow(value: string | undefined | null): { start: string; end: string } | null {
  const m = value?.match(/^\s*(?:[A-Za-z]{3}\s+)?(\d{1,2}:\d{2})\s*[–—-]\s*(?:[A-Za-z]{3}\s+)?(\d{1,2}:\d{2})(?:\s*\(\+1 day\))?\s*$/);
  return m ? { start: pad(m[1]!), end: pad(m[2]!) } : null;
}

/** The stored text: "20:00–23:00", or "22:00–02:00 (+1 day)" when it runs past midnight. */
export const formatWindow = (start: string, end: string) => `${start}–${end}${minutes(end) <= minutes(start) ? " (+1 day)" : ""}`;

function duration(start: string, end: string) {
  const mins = (minutes(end) - minutes(start) + 1440) % 1440 || 1440;
  const h = Math.floor(mins / 60), m = mins % 60;
  return [h && `${h} h`, m && `${m} min`].filter(Boolean).join(" ");
}

type Props = {
  /** Matches the <Field htmlFor>: the label focuses the start time. */
  id: string;
  value: string | undefined | null;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

/**
 * Change window as a start and end time, so entries are consistent ("20:00–23:00").
 * An end before the start means it runs overnight. For changes that aren't a time slot
 * ("Effective 1 Dec"), "Describe it instead" switches to free text.
 */
export function TimeWindowPicker({ id, value, onChange, onBlur }: Props) {
  const parsed = parseWindow(value);
  const [mode, setMode] = useState<"times" | "text">(() => (value && !parsed ? "text" : "times"));
  // Halves of a window in progress (only one picked yet) live here until both are set.
  const [draft, setDraft] = useState<{ start?: string; end?: string }>(() => parsed ?? {});
  const start = parsed?.start ?? draft.start, end = parsed?.end ?? draft.end;

  const set = (next: { start?: string; end?: string }) => {
    setDraft(next);
    onChange(next.start && next.end ? formatWindow(next.start, next.end) : "");
  };

  if (mode === "text") {
    return (
      <div className="space-y-1.5">
        <Input id={id} value={value ?? ""} placeholder="e.g. Effective 1 Dec, or Go-live 08:00" onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
        <button type="button" onClick={() => { setMode("times"); set({}); }} className="text-xs font-bold text-teal hover:underline">
          Use start and end times
        </button>
      </div>
    );
  }

  const overnight = start && end && minutes(end) <= minutes(start);
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <Combobox id={id} aria-label="Window start time" value={start} placeholder="Start" options={TIMES} onBlur={onBlur}
          onChange={(v) => set({ start: v, end })} />
        <span className="text-sm text-muted" aria-hidden>to</span>
        <Combobox aria-label="Window end time" value={end} placeholder="End" options={TIMES} onBlur={onBlur}
          onChange={(v) => set({ start, end: v })} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="flex items-center gap-1 text-muted" aria-live="polite">
          {start && end ? (
            <>
              {overnight && <Moon size={12} aria-hidden />}
              {overnight ? `Overnight, ends ${end} the next day` : "Same day"} · {duration(start, end)}
            </>
          ) : (
            "Pick a start and end time"
          )}
        </span>
        <button type="button" onClick={() => { setMode("text"); onChange(""); }} className="font-bold text-teal hover:underline">
          Describe it instead
        </button>
      </div>
    </div>
  );
}
