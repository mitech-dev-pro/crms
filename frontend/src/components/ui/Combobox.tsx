"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAnchoredPanel, useClickOutside } from "@/lib/use-anchored-panel";

export type ComboOption = {
  value: string;
  label: string;
  /** Extra text shown and searched, e.g. a department or email. */
  hint?: string;
  /** Extra words matched by the search but not shown, e.g. "2030 8:30pm" for 20:30. */
  keywords?: string;
};

type Props = {
  /** Matches the <Field htmlFor>. Or use aria-label when there's no visible label. */
  id?: string;
  "aria-label"?: string;
  value: string | undefined | null;
  onChange: (value: string | undefined) => void;
  onBlur?: () => void;
  options: ComboOption[];
  /** Adds a first option meaning "none", e.g. "Not assigned yet" or "All departments". Picking it gives undefined. */
  noneLabel?: string;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  title?: string;
  className?: string;
};

/** Bold the part of `text` that matches the search. */
function highlight(text: string, q: string): ReactNode {
  const i = q ? text.toLowerCase().indexOf(q) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-extrabold text-ink">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

/**
 * A dropdown you can type into to filter, for lists that grow: people, departments.
 * Short fixed lists (status, risk tier, sort order) stay as a plain <Select>.
 *
 * Keyboard: type to filter, ↑/↓ to move, Enter to choose, Escape to close without changing.
 * Follows the ARIA combobox pattern, so screen readers announce the list and the active option.
 *
 * With React Hook Form, wrap it in a <Controller> like DatePicker.
 */
export function Combobox({
  id, "aria-label": ariaLabel, value, onChange, onBlur, options, noneLabel, placeholder = "Select…", invalid, disabled, title, className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState<string | null>(null); // null = not searching, show the chosen label
  const [active, setActive] = useState(0);
  const anchor = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const uid = useId();
  const listId = `${uid}-list`;

  const selected = options.find((o) => o.value === value);
  const q = (query ?? "").trim().toLowerCase();
  // Best matches first: the label starts with the search, then any word does ("2am" before "12am"),
  // then the search appears anywhere in the label, hint or keywords.
  const rank = (o: ComboOption) => {
    const text = `${o.label} ${o.hint ?? ""} ${o.keywords ?? ""}`.toLowerCase();
    if (o.label.toLowerCase().startsWith(q)) return 0;
    if (text.split(/[\s·,()@.-]+/).some((w) => w.startsWith(q))) return 1;
    return text.includes(q) ? 2 : -1;
  };
  const matches = q
    ? options
        .map((o, i) => ({ o, i, r: rank(o) }))
        .filter((m) => m.r >= 0)
        .sort((x, y) => x.r - y.r || x.i - y.i)
        .map((m) => m.o)
    : options;
  const items: ComboOption[] = noneLabel && !q ? [{ value: "", label: noneLabel }, ...matches] : matches;

  const close = useCallback(() => {
    setOpen(false);
    setQuery(null);
  }, []);

  function openList() {
    if (disabled) return;
    const i = items.findIndex((o) => o.value === (value ?? ""));
    setActive(Math.max(0, i));
    setOpen(true);
  }

  function choose(o: ComboOption | undefined) {
    if (!o) return;
    onChange(o.value || undefined);
    close();
    input.current?.focus();
  }

  useAnchoredPanel(open, anchor, list, { width: "anchor", deps: [items.length] });
  useClickOutside(open, [anchor, list], close);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (open) list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      const n = items.length;
      if (n) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
    } else if (e.key === "Home" && open) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && open) {
      e.preventDefault();
      setActive(items.length - 1);
    } else if (e.key === "Enter") {
      if (open) {
        e.preventDefault(); // choose, don't submit the form
        choose(items[active]);
      }
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  }

  const shown = query ?? (selected?.label ?? "");

  return (
    <div ref={anchor} className={`relative ${className}`} title={title}>
      <input
        ref={input}
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && id ? `${id}-error` : undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={shown}
        placeholder={selected ? undefined : noneLabel ?? placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onClick={() => (open ? undefined : openList())}
        onKeyDown={onKey}
        onBlur={(e) => {
          if (list.current?.contains(e.relatedTarget as Node)) return;
          close();
          onBlur?.();
        }}
        className={`w-full truncate rounded-lg border bg-surface py-2 pr-9 pl-3 text-sm text-ink placeholder:text-faint outline-none focus:border-teal-bright focus:ring-2 focus:ring-teal-bright/20 disabled:cursor-not-allowed disabled:opacity-50 ${
          invalid ? "border-danger-ring" : "border-line-strong"
        } ${!selected && noneLabel ? "placeholder:text-ink-2" : ""}`}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-hidden
        onMouseDown={(e) => e.preventDefault()} // keep focus in the input
        onClick={() => {
          if (open) close();
          else {
            input.current?.focus();
            openList();
          }
        }}
        className="absolute inset-y-0 right-0 grid w-9 place-items-center text-muted disabled:cursor-not-allowed"
      >
        <ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="fixed z-50 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-xl"
          >
            {items.map((o, i) => {
              const isSelected = (value ?? "") === o.value;
              return (
                <li
                  key={o.value || "__none"}
                  id={`${listId}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()} // keep focus in the input
                  onMouseMove={() => active !== i && setActive(i)}
                  onClick={() => choose(o)}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm ${i === active ? "bg-surface-2" : ""} ${
                    o.value ? "text-ink-2" : "text-muted italic"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{highlight(o.label, q)}</span>
                    {o.hint && <span className="block truncate text-xs text-muted">{highlight(o.hint, q)}</span>}
                  </span>
                  {isSelected && <Check size={14} className="shrink-0 text-teal" aria-hidden />}
                </li>
              );
            })}
            {!items.length && <li className="px-2.5 py-2 text-sm text-muted">No matches for &ldquo;{query}&rdquo;</li>}
          </ul>,
          document.body,
        )}
    </div>
  );
}
