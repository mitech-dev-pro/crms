"use client";

import { Menu, Search } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMe } from "@/lib/queries";
import { openCommandPalette } from "./CommandPalette";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

const TITLES: [prefix: string, title: string][] = [
  ["/changes/new", "New request"],
  ["/changes/", "Change request"],
  ["/changes", "Change requests"],
  ["/approvals", "My approvals"],
  ["/calendar", "Change calendar"],
  ["/flows", "Process flows"],
  ["/reports", "Reports"],
  ["/audit", "Audit trail"],
  ["/admin", "Administration"],
  ["/dashboard", "Dashboard"],
];

export default function AppHeader({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const title = TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? "ChangeHub";
  // Browser tab title, e.g. "My approvals · MiLife ChangeHub" or "CHG-2026-0144 · MiLife ChangeHub".
  const ref = pathname.match(/^\/changes\/(CHG-\d{4}-\d{4})/)?.[1];
  const tabTitle = `${ref ?? title} · MiLife ChangeHub`;

  return (
    <>
    {/* React hoists <title> into <head>. */}
    <title>{tabTitle}</title>
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 md:px-6">
      <button onClick={onMenu} aria-label="Open menu" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 md:hidden">
        <Menu size={20} />
      </button>
      <h1 className="flex-1 truncate text-lg font-extrabold text-ink">{title}</h1>

      {/* Opens the Ctrl+K quick jump: change numbers, titles and pages. */}
      <button
        type="button"
        onClick={openCommandPalette}
        aria-keyshortcuts="Control+K Meta+K"
        className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface-2 p-2 text-sm text-muted hover:border-teal-bright sm:w-64 sm:py-2 sm:pr-2 sm:pl-3"
      >
        <Search size={15} className="shrink-0" aria-hidden />
        {/* The visible text is the button's name; on phones it's kept for screen readers only. */}
        <span className="sr-only flex-1 truncate text-left whitespace-nowrap sm:not-sr-only">{me?.permissions.includes("changes") ? "Search change ID or title" : "Go to a page"}</span>
        <kbd aria-hidden className="hidden rounded border border-line bg-surface px-1.5 font-mono text-[11px] text-muted sm:block">Ctrl K</kbd>
      </button>
      <NotificationBell />
      <ThemeToggle />
    </header>
    </>
  );
}
