"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { addDays, addMonths, monthGrid, parseDateInput, parseYmd, weekdayMon, ymd } from "@/lib/dates";

/** A highlighted span of days, e.g. a change freeze. Dates are "YYYY-MM-DD", inclusive. */
export type DateMarker = { from: string; to: string; label: string };

type Props = {
  /** Matches the <Field htmlFor>: the label focuses the text box and errors are announced. */
  id: string;
  /** "YYYY-MM-DD", or empty for no date. */
  value?: string | null;
  onChange: (value: string | undefined) => void;
  /** Called when the field is left. Lets React Hook Form mark it as touched. */
  onBlur?: () => void;
  /** Earliest and latest allowed days, "YYYY-MM-DD", inclusive. */
  min?: string;
  max?: string;
  markers?: DateMarker[];
  /** Legend text for the marked days, e.g. "Freeze window". */
  markerLegend?: string;
  invalid?: boolean;
  disabled?: boolean;
  /** Show a Clear button in the calendar (for optional dates). */
  clearable?: boolean;
  placeholder?: string;
};

type View = "days" | "months" | "years";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString("en-GB", { month: "short" }));
const PANEL_WIDTH = 288; // px
const GAP = 6;
const hatch = "repeating-linear-gradient(135deg, var(--amber-bg) 0 5px, transparent 5px 10px)";

const longDate = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
/** What the text box shows once a date is read: "Sun, 20 Dec 1998". It confirms how the typing was understood. */
const display = (iso: string | null | undefined) => {
  const d = parseYmd(iso);
  return d ? d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "";
};
const yearPageStart = (y: number) => y - (((y % 12) + 12) % 12);

/**
 * A date field for use across the app. Type a date or pick it from the calendar.
 *
 * - Typing: day-first formats such as 20/12/1998, 20-12-98, 20 Dec 1998, 1998-12-20 or "today".
 *   On leaving the field (or Enter) it is rewritten as "Sun, 20 Dec 1998", so you can see how it was read.
 * - Calendar: click the month or year in the header to jump straight to it.
 * - Keyboard: Alt+↓ (or ↓) opens the calendar. Inside it, the arrows move, PageUp/PageDown change month
 *   (Shift for a year), Enter picks, Escape steps back out.
 *
 * With React Hook Form, wrap it in a <Controller>:
 *   <Controller name="plannedDate" control={control} render={({ field }) => (
 *     <DatePicker id="plannedDate" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
 *   )} />
 */
export function DatePicker({
  id, value, onChange, onBlur, min, max, markers = [], markerLegend, invalid, disabled, clearable = false, placeholder = "DD/MM/YYYY",
}: Props) {
  const current = value || undefined;
  const [text, setText] = useState(() => display(current));
  const [typeError, setTypeError] = useState<string | null>(null);
  // The value this field last showed. When the form changes it from outside (reset, edit mode), refresh the text.
  const [shown, setShown] = useState(current);
  if (current !== shown) {
    setShown(current);
    setText(display(current));
    setTypeError(null);
  }

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("days");
  const [focusDay, setFocusDay] = useState<Date>(() => new Date());
  const anchor = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false); // set when the keyboard moved the active cell, so focus follows it
  const uid = useId();
  const titleId = `${uid}-title`, panelId = `${uid}-panel`, typeErrorId = `${id}-typed-error`;

  const problemWith = (iso: string) =>
    min && iso < min ? `Choose a date on or after ${display(min)}` : max && iso > max ? `Choose a date on or before ${display(max)}` : null;
  const inRange = (d: Date) => !problemWith(ymd(d));
  const monthInRange = (y: number, m: number) => (!min || ymd(new Date(y, m + 1, 0)) >= min) && (!max || ymd(new Date(y, m, 1)) <= max);
  const yearInRange = (y: number) => (!min || `${y}-12-31` >= min) && (!max || `${y}-01-01` <= max);
  const markerOn = (d: Date) => {
    const k = ymd(d);
    return markers.find((m) => k >= m.from && k <= m.to);
  };

  /** Sends a new value up, remembering it so the text box isn't overwritten by our own change. */
  function emit(next: string | undefined) {
    setShown(next);
    onChange(next);
  }

  /** Reads what was typed. Bad input keeps the text (so it can be fixed) and clears the value. */
  function commit(raw: string) {
    if (!raw.trim()) {
      setText("");
      setTypeError(null);
      if (current) emit(undefined);
      return;
    }
    const iso = parseDateInput(raw);
    const problem = iso ? problemWith(iso) : "Enter a date like 20/12/1998";
    if (problem || !iso) {
      setTypeError(problem);
      if (current) emit(undefined);
      return;
    }
    setTypeError(null);
    setText(display(iso));
    if (iso !== current) emit(iso);
  }

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    onBlur?.();
    if (returnFocus) input.current?.focus();
  }, [onBlur]);

  function openPicker() {
    // Start on what's typed (even if not yet committed), else the value, else today kept inside min/max.
    const t = ymd(new Date());
    const typed = parseDateInput(text);
    setFocusDay(parseYmd(typed ?? current) ?? parseYmd(min && t < min ? min : max && t > max ? max : t)!);
    setView("days");
    moveFocus.current = true;
    setOpen(true);
  }

  function pick(d: Date) {
    if (!inRange(d)) return;
    const iso = ymd(d);
    setText(display(iso));
    setTypeError(null);
    emit(iso);
    close(true);
  }

  function changeView(next: View) {
    moveFocus.current = true;
    setView(next);
  }

  // Place the panel under the field (or above it if there's no room), inside the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect(), p = panel.current;
      if (!a || !p) return;
      const h = p.offsetHeight;
      const below = a.bottom + GAP + h <= window.innerHeight || a.top - GAP - h < 0;
      p.style.top = `${below ? a.bottom + GAP : a.top - GAP - h}px`;
      p.style.left = `${Math.max(8, Math.min(a.left, window.innerWidth - PANEL_WIDTH - 8))}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true); // capture: any scrolling ancestor
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, focusDay, view]);

  // Keyboard focus follows the active cell.
  useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    panel.current?.querySelector<HTMLButtonElement>('[data-active="true"]')?.focus();
  }, [open, focusDay, view]);

  // Close on a click outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) close(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault(); // don't submit the form; read the date instead
      commit(text);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      commit(text);
      openPicker();
    } else if (e.key === "Escape" && open) {
      close(false);
    }
  }

  function onPanelKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (view === "days") close(true);
      else changeView(view === "years" ? "months" : "days");
    } else if (e.key === "Tab") {
      // Keep Tab inside the dialog while it's open.
      const items = [...(panel.current?.querySelectorAll<HTMLElement>('button[tabindex="0"], button:not([tabindex])') ?? [])];
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
      e.preventDefault();
      items[next]?.focus();
    }
  }

  // Arrow-key moves per view. Months and years are 3 columns wide.
  function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
    const big = e.shiftKey ? 12 : 1;
    const moves: Record<View, Record<string, (d: Date) => Date>> = {
      days: {
        ArrowLeft: (d) => addDays(d, -1), ArrowRight: (d) => addDays(d, 1), ArrowUp: (d) => addDays(d, -7), ArrowDown: (d) => addDays(d, 7),
        Home: (d) => addDays(d, -weekdayMon(d)), End: (d) => addDays(d, 6 - weekdayMon(d)),
        PageUp: (d) => addMonths(d, -big), PageDown: (d) => addMonths(d, big),
      },
      months: {
        ArrowLeft: (d) => addMonths(d, -1), ArrowRight: (d) => addMonths(d, 1), ArrowUp: (d) => addMonths(d, -3), ArrowDown: (d) => addMonths(d, 3),
        PageUp: (d) => addMonths(d, -12), PageDown: (d) => addMonths(d, 12),
      },
      years: {
        ArrowLeft: (d) => addMonths(d, -12), ArrowRight: (d) => addMonths(d, 12), ArrowUp: (d) => addMonths(d, -36), ArrowDown: (d) => addMonths(d, 36),
        PageUp: (d) => addMonths(d, -144), PageDown: (d) => addMonths(d, 144),
      },
    };
    const move = moves[view][e.key];
    if (move) {
      e.preventDefault();
      moveFocus.current = true;
      setFocusDay(move(focusDay));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (view === "days") pick(focusDay);
      else changeView(view === "years" ? "months" : "days");
    }
  }

  const step = (dir: 1 | -1) => setFocusDay((d) => addMonths(d, dir * (view === "days" ? 1 : view === "months" ? 12 : 144)));
  const year = focusDay.getFullYear(), month = focusDay.getMonth();
  const today = new Date();
  const todayKey = ymd(today);
  const days = monthGrid(year, month);
  const weeks = Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7));
  const monthHasMarker = view === "days" && days.some((d) => d.getMonth() === month && markerOn(d));
  const firstYear = yearPageStart(year);
  const selected = parseYmd(current);
  const showError = typeError !== null;

  const cell = (active: boolean, isSelected: boolean, allowed: boolean, dim = false) =>
    `rounded-lg text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-bright ${
      isSelected ? "bg-navy font-bold text-white" : !allowed ? "cursor-not-allowed text-faint opacity-40" : dim ? "text-faint hover:bg-surface-2" : "text-ink hover:bg-surface-2"
    } ${active && !isSelected ? "ring-1 ring-line-strong" : ""}`;
  const headerBtn = "inline-flex items-center gap-0.5 rounded-lg px-2 py-1 text-sm font-extrabold text-ink hover:bg-surface-2";

  return (
    <div>
      <div ref={anchor} className="relative">
        <input
          ref={input}
          id={id}
          type="text"
          inputMode="text"
          autoComplete="off"
          disabled={disabled}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            if (typeError) setTypeError(null);
          }}
          onBlur={(e) => {
            // Moving into the open calendar isn't leaving the field; anything else reads the typing.
            const to = e.relatedTarget as Node | null;
            if (panel.current?.contains(to)) return;
            commit(text);
            if (!anchor.current?.contains(to)) onBlur?.();
          }}
          onKeyDown={onInputKey}
          aria-invalid={invalid || showError || undefined}
          aria-describedby={[showError ? typeErrorId : "", invalid ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined}
          className={`w-full rounded-lg border bg-surface py-2 pr-10 pl-3 text-sm text-ink placeholder:text-faint outline-none focus:border-teal-bright focus:ring-2 focus:ring-teal-bright/20 disabled:cursor-not-allowed disabled:opacity-50 ${
            invalid || showError ? "border-danger-ring" : "border-line-strong"
          }`}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => (open ? close(false) : (commit(text), openPicker()))}
          aria-label="Choose date from calendar"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-muted hover:text-ink disabled:cursor-not-allowed"
        >
          <CalendarDays size={16} />
        </button>
      </div>
      {showError && (
        <p id={typeErrorId} className="mt-1.5 text-xs font-semibold text-danger">{typeError}</p>
      )}

      {open &&
        createPortal(
          <div
            ref={panel}
            id={panelId}
            role="dialog"
            aria-label="Choose a date"
            onKeyDown={onPanelKey}
            style={{ width: PANEL_WIDTH }}
            className="fixed z-50 rounded-xl border border-line bg-surface p-3 shadow-xl"
          >
            {/* Header: arrows step by month / year / 12 years; the labels switch views. */}
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => step(-1)} aria-label={view === "days" ? "Previous month" : view === "months" ? "Previous year" : "Previous years"} className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2">
                <ChevronLeft size={16} />
              </button>
              <div id={titleId} aria-live="polite" className="flex items-center">
                {view === "days" && (
                  <>
                    <button type="button" onClick={() => changeView("months")} aria-label={`Choose month, ${focusDay.toLocaleDateString("en-GB", { month: "long" })}`} className={headerBtn}>
                      {focusDay.toLocaleDateString("en-GB", { month: "long" })} <ChevronDown size={13} className="text-muted" />
                    </button>
                    <button type="button" onClick={() => changeView("years")} aria-label={`Choose year, ${year}`} className={headerBtn}>
                      {year} <ChevronDown size={13} className="text-muted" />
                    </button>
                  </>
                )}
                {view === "months" && (
                  <button type="button" onClick={() => changeView("years")} aria-label={`Choose year, ${year}`} className={headerBtn}>
                    {year} <ChevronDown size={13} className="text-muted" />
                  </button>
                )}
                {view === "years" && <span className="px-2 py-1 text-sm font-extrabold text-ink">{firstYear} – {firstYear + 11}</span>}
              </div>
              <button type="button" onClick={() => step(1)} aria-label={view === "days" ? "Next month" : view === "months" ? "Next year" : "Next years"} className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2">
                <ChevronRight size={16} />
              </button>
            </div>

            {view === "days" && (
              <div role="grid" aria-labelledby={titleId} onKeyDown={onGridKey}>
                <div role="row" className="grid grid-cols-7">
                  {WEEKDAYS.map((w) => (
                    <span key={w} role="columnheader" className="py-1 text-center text-[11px] font-bold text-faint">{w}</span>
                  ))}
                </div>
                {weeks.map((week) => (
                  <div role="row" key={ymd(week[0]!)} className="grid grid-cols-7">
                    {week.map((d) => {
                      const key = ymd(d);
                      const active = key === ymd(focusDay);
                      const isSelected = key === current;
                      const marker = markerOn(d);
                      return (
                        <div role="gridcell" key={key} aria-selected={isSelected} className="p-0.5">
                          <button
                            type="button"
                            tabIndex={active ? 0 : -1}
                            data-active={active}
                            onClick={() => pick(d)}
                            aria-disabled={!inRange(d) || undefined}
                            aria-current={key === todayKey ? "date" : undefined}
                            aria-label={`${longDate(d)}${marker ? `, ${marker.label}` : ""}`}
                            title={marker?.label}
                            style={marker && !isSelected ? { backgroundImage: hatch } : undefined}
                            className={`relative grid size-9 place-items-center tabular-nums ${cell(active, isSelected, inRange(d), d.getMonth() !== month)} ${
                              key === todayKey && !isSelected ? "font-extrabold text-teal" : ""
                            }`}
                          >
                            {d.getDate()}
                            {key === todayKey && <span className={`absolute bottom-1 size-1 rounded-full ${isSelected ? "bg-white" : "bg-teal"}`} aria-hidden />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {view === "months" && (
              <div role="group" aria-label={`Months of ${year}`} onKeyDown={onGridKey} className="grid grid-cols-3 gap-1.5">
                {MONTHS.map((name, m) => {
                  const active = m === month;
                  const allowed = monthInRange(year, m);
                  return (
                    <button
                      key={name}
                      type="button"
                      tabIndex={active ? 0 : -1}
                      data-active={active}
                      aria-disabled={!allowed || undefined}
                      aria-pressed={selected?.getFullYear() === year && selected.getMonth() === m}
                      aria-label={new Date(year, m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
                      onClick={() => {
                        if (!allowed) return;
                        setFocusDay(new Date(year, m, Math.min(focusDay.getDate(), new Date(year, m + 1, 0).getDate())));
                        changeView("days");
                      }}
                      className={`h-12 font-semibold ${cell(active, selected?.getFullYear() === year && selected.getMonth() === m, allowed)}`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            )}

            {view === "years" && (
              <div role="group" aria-label={`Years ${firstYear} to ${firstYear + 11}`} onKeyDown={onGridKey} className="grid grid-cols-3 gap-1.5">
                {Array.from({ length: 12 }, (_, i) => firstYear + i).map((y) => {
                  const active = y === year;
                  const allowed = yearInRange(y);
                  return (
                    <button
                      key={y}
                      type="button"
                      tabIndex={active ? 0 : -1}
                      data-active={active}
                      aria-disabled={!allowed || undefined}
                      aria-pressed={selected?.getFullYear() === y}
                      onClick={() => {
                        if (!allowed) return;
                        setFocusDay(addMonths(focusDay, (y - year) * 12));
                        changeView("months");
                      }}
                      className={`h-12 font-semibold tabular-nums ${cell(active, selected?.getFullYear() === y, allowed)} ${y === today.getFullYear() && selected?.getFullYear() !== y ? "text-teal" : ""}`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
              {monthHasMarker && markerLegend ? (
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                  <span className="size-3 rounded-sm border border-line" style={{ backgroundImage: hatch }} aria-hidden /> {markerLegend}
                </span>
              ) : <span />}
              <div className="flex gap-1">
                {clearable && current && (
                  <button
                    type="button"
                    onClick={() => {
                      setText("");
                      emit(undefined);
                      close(true);
                    }}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-muted hover:bg-surface-2"
                  >
                    Clear
                  </button>
                )}
                {inRange(today) && (
                  <button type="button" onClick={() => pick(today)} className="rounded-lg px-2 py-1 text-xs font-bold text-teal hover:bg-teal-tint">
                    Today
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
