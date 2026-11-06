"use client";

import { useSyncExternalStore } from "react";
import { formatDateTime } from "@/lib/format";

// One shared clock for every <RelativeTime> on the page, ticking every 30 seconds,
// so "just now" becomes "1 minute ago" without each timestamp running its own timer.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(l: () => void) {
  listeners.add(l);
  timer ??= setInterval(() => {
    now = Date.now();
    listeners.forEach((f) => f());
  }, 30_000);
  return () => {
    listeners.delete(l);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}
const getNow = () => now;

const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" }); // "yesterday", "2 hours ago"

/** "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago"; older than a week → the date. */
export function relativeTime(iso: string, at = Date.now()) {
  const secs = Math.round((new Date(iso).getTime() - at) / 1000);
  const abs = Math.abs(secs);
  if (abs < 45) return "just now";
  if (abs < 3600) return rtf.format(Math.round(secs / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(secs / 3600), "hour");
  if (abs < 7 * 86_400) return rtf.format(Math.round(secs / 86_400), "day");
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** A timestamp shown as "2 hours ago", with the exact time on hover (and for screen readers via dateTime). */
export function RelativeTime({ iso, className = "" }: { iso: string | null | undefined; className?: string }) {
  const current = useSyncExternalStore(subscribe, getNow, getNow);
  if (!iso) return <span className={className}>—</span>;
  return (
    <time dateTime={iso} title={formatDateTime(iso)} className={`cursor-help ${className}`}>
      {relativeTime(iso, current)}
    </time>
  );
}
