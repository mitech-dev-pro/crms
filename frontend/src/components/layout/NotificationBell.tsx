"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useMe, useNotifications } from "@/lib/queries";

/** Header bell: what needs your attention right now, refreshed every minute. */
export default function NotificationBell() {
  const { data: me } = useMe();
  const { items } = useNotifications(me);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Close on a click outside, or Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${items.length ? `: ${items.length} need your attention` : ""}`}
        aria-expanded={open}
        className="relative rounded-lg border border-line-strong p-2 text-ink-2 hover:bg-surface-2"
      >
        <Bell size={16} />
        {items.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] leading-4 font-extrabold text-white">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          <p className="border-b border-line px-4 py-2.5 text-sm font-extrabold text-ink">Needs your attention</p>
          {items.length ? (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={`${n.ref}-${n.reason}`}>
                  <Link href={`/changes/${n.ref}`} onClick={() => setOpen(false)} className="block px-4 py-2.5 hover:bg-surface-2">
                    <p className="truncate text-sm font-bold text-ink">{n.title}</p>
                    <p className="text-xs text-muted"><span className="font-mono">{n.ref}</span> · {n.reason}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-muted">You&apos;re all caught up.</p>
          )}
        </div>
      )}
    </div>
  );
}
