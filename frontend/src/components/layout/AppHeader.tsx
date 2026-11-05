"use client";

import { Menu, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useMe } from "@/lib/queries";
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
  const router = useRouter();
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const title = TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? "ChangeHub";

  const search = (e: FormEvent) => {
    e.preventDefault();
    router.push(`/changes?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface px-4 md:px-6">
      <button onClick={onMenu} aria-label="Open menu" className="rounded-lg p-2 text-ink-2 hover:bg-surface-2 md:hidden">
        <Menu size={20} />
      </button>
      <h1 className="flex-1 truncate text-lg font-extrabold text-ink">{title}</h1>

      {me?.permissions.includes("changes") && (
        <form onSubmit={search} role="search" className="relative hidden sm:block">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search change ID or title"
            aria-label="Search change requests"
            className="w-64 rounded-lg border border-line-strong bg-surface-2 py-2 pr-3 pl-9 text-sm text-ink placeholder:text-faint outline-none focus:border-teal-bright"
          />
        </form>
      )}
      <ThemeToggle />
    </header>
  );
}
