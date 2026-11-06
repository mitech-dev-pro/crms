"use client";

import type { ChangeListResponse } from "@crms/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, CornerDownLeft, FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { StatusBadge } from "@/components/ui/Badges";
import { api } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { NAV } from "./AppSidebar";

type Item = { key: string; group: "Changes" | "Go to"; label: string; hint?: ReactNode; href: string; icon: ReactNode };

/** True on Macs, where the shortcut is ⌘K instead of Ctrl+K. */
const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/** Opens the palette from anywhere: Ctrl+K / ⌘K, or a "palette:open" event (the header button). */
export function openCommandPalette() {
  window.dispatchEvent(new Event("palette:open"));
}

/**
 * Ctrl+K (⌘K on a Mac): jump to a change by its number or title, or to any page you can open.
 * Type "144" or "CHG-2026-0144" or words from the title. ↑/↓ to move, Enter to open, Escape to close.
 */
export default function CommandPalette() {
  const router = useRouter();
  const { data: me } = useMe();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState(""); // q, 200ms after typing stops
  const [active, setActive] = useState(0);
  const canSearch = !!me?.permissions.includes("changes");

  // The shortcut, and the header button's event.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("palette:open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("palette:open", onOpen);
    };
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (open && !d?.open) {
      d?.showModal();
      input.current?.focus();
    } else if (!open && d?.open) d.close();
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  // A bare number like "144" means a change number: search the reference.
  const term = /^\d{1,4}$/.test(search) ? search.padStart(4, "0") : search;
  const results = useQuery({
    queryKey: ["palette", term],
    queryFn: () => api<ChangeListResponse>("/changes", { query: { q: term, pageSize: 6, sort: "newest" } }),
    enabled: open && canSearch && term.length > 0,
    placeholderData: keepPreviousData,
  });

  const lower = q.trim().toLowerCase();
  const pages: Item[] = NAV.filter((n) => me?.permissions.includes(n.screen) && (!lower || n.label.toLowerCase().includes(lower))).map((n) => ({
    key: n.href, group: "Go to", label: n.label, href: n.href, icon: <n.icon size={16} />,
  }));
  const changes: Item[] = (term ? results.data?.items ?? [] : []).map((c) => ({
    key: c.ref, group: "Changes", label: c.title, href: `/changes/${c.ref}`, icon: <FileText size={16} />,
    hint: (
      <span className="flex items-center gap-2">
        <span className="font-mono">{c.ref}</span> · {c.department.name} <StatusBadge status={c.status} />
      </span>
    ),
  }));
  const items = [...changes, ...pages];
  const sel = Math.min(active, Math.max(items.length - 1, 0));

  function close() {
    setOpen(false);
    setQ("");
    setSearch("");
    setActive(0);
  }

  function go(item: Item | undefined) {
    if (item) router.push(item.href);
    else if (q.trim() && canSearch) router.push(`/changes?q=${encodeURIComponent(q.trim())}`); // nothing picked: full search
    else return;
    close();
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const n = items.length;
      if (n) setActive((sel + (e.key === "ArrowDown" ? 1 : -1) + n) % n);
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[sel]);
    }
  }

  // Keep the highlighted row in view.
  useEffect(() => {
    dialog.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  let lastGroup = "";
  return (
    <dialog
      ref={dialog}
      aria-label="Quick jump"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => e.target === dialog.current && close()}
      className="mx-auto mt-[12vh] w-[min(36rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-[#0d1322]/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search size={18} className="shrink-0 text-muted" aria-hidden />
        <input
          ref={input}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded
          aria-controls="palette-list"
          aria-activedescendant={items[sel] ? `palette-${sel}` : undefined}
          aria-label="Search changes and pages"
          placeholder={canSearch ? "Change number, title, or a page…" : "Go to a page…"}
          className="h-14 flex-1 bg-transparent text-base text-ink placeholder:text-faint outline-none"
        />
        {results.isFetching && <span className="size-4 animate-spin rounded-full border-2 border-teal border-t-transparent" aria-hidden />}
        <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-muted">Esc</kbd>
      </div>

      <ul id="palette-list" role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto p-2">
        {items.map((item, i) => {
          const header = item.group !== lastGroup ? item.group : null;
          lastGroup = item.group;
          return (
            <li key={item.key} role="presentation">
              {header && <p className="px-2.5 pt-2 pb-1 text-[11px] font-bold tracking-wide text-faint uppercase">{header}</p>}
              <div
                id={`palette-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === sel}
                onMouseMove={() => i !== sel && setActive(i)}
                onClick={() => go(item)}
                className={`flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm ${i === sel ? "bg-teal-tint" : ""}`}
              >
                <span className={i === sel ? "text-teal" : "text-muted"}>{item.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{item.label}</span>
                  {item.hint && <span className="block truncate text-xs text-muted">{item.hint}</span>}
                </span>
                {i === sel && <ArrowRight size={14} className="shrink-0 text-teal" aria-hidden />}
              </div>
            </li>
          );
        })}
        {!items.length && (
          <li className="px-3 py-8 text-center text-sm text-muted">
            {results.isFetching ? "Searching…" : <>No changes or pages match &ldquo;{q}&rdquo;.</>}
          </li>
        )}
      </ul>

      <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-muted">
        <span className="flex items-center gap-1"><kbd className="font-mono">↑↓</kbd> move</span>
        <span className="flex items-center gap-1"><CornerDownLeft size={11} /> open</span>
        <span className="ml-auto">{isMac() ? "⌘" : "Ctrl"} K to toggle</span>
      </div>
    </dialog>
  );
}
