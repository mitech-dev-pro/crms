"use client";

import { ROLE_LABELS, type Screen } from "@crms/shared";
import {
  CalendarDays, ClipboardCheck, FilePlus2, FileText, GitBranch, KeyRound, LayoutDashboard, LogOut, PieChart, ScrollText, Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { initials } from "@/lib/format";
import { useInbox, useLogout, useMe } from "@/lib/queries";
import Logo from "./Logo";

// Order and labels follow the prototype's NAV. Each item is a screen key from the shared PERMS table.
const NAV: { screen: Screen; label: string; href: string; icon: typeof LayoutDashboard }[] = [
  { screen: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { screen: "changes", label: "Change requests", href: "/changes", icon: FileText },
  { screen: "new", label: "New request", href: "/changes/new", icon: FilePlus2 },
  { screen: "approvals", label: "My approvals", href: "/approvals", icon: ClipboardCheck },
  { screen: "calendar", label: "Change calendar", href: "/calendar", icon: CalendarDays },
  { screen: "flows", label: "Process flows", href: "/flows", icon: GitBranch },
  { screen: "reports", label: "Reports", href: "/reports", icon: PieChart },
  { screen: "audit", label: "Audit trail", href: "/audit", icon: ScrollText },
  { screen: "admin", label: "Administration", href: "/admin", icon: Settings },
];

export default function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: me } = useMe();
  const canApprove = !!me?.permissions.includes("approvals");
  const inbox = useInbox(canApprove);
  const logout = useLogout();
  if (!me) return null;

  // Only the screens this role may open (same list the API enforces).
  const items = NAV.filter((n) => me.permissions.includes(n.screen));
  // "/changes/new" should light up "New request", not "Change requests".
  const isActive = (href: string) =>
    href === "/changes" ? pathname === "/changes" || (pathname.startsWith("/changes/") && pathname !== "/changes/new") : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line bg-surface">
      <div className="px-5 pt-6 pb-4">
        <Logo className="h-12" />
        <p className="mt-2 text-[11px] font-extrabold tracking-[0.12em] text-teal uppercase">Change management</p>
      </div>

      <nav aria-label="Main" className="flex-1 space-y-0.5 px-3">
        {items.map(({ href, label, icon: Icon, screen }) => {
          const active = isActive(href);
          const badge = screen === "approvals" ? inbox.data?.items.length ?? 0 : 0;
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? "bg-teal-tint font-extrabold text-teal-strong" : "font-semibold text-ink-2 hover:bg-surface-2"
              }`}
            >
              <Icon size={17} />
              <span className="flex-1">{label}</span>
              {badge > 0 && (
                <span className="rounded-full px-1.5 py-0.5 text-[11px] font-extrabold" style={{ background: "var(--amber-bg)", color: "var(--amber-fg)" }}>
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="m-3 rounded-xl border border-line p-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-extrabold text-white">{initials(me.name)}</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold text-ink">{me.name}</p>
            <p className="truncate text-xs text-muted">
              {ROLE_LABELS[me.role]} · {me.department.name}
            </p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <Link
            href="/change-password"
            onClick={onNavigate}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-xs font-bold text-ink-2 hover:bg-surface-2"
          >
            <KeyRound size={13} /> Password
          </Link>
          <button
            onClick={() => logout.mutate()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-2 py-1.5 text-xs font-bold text-ink-2 hover:bg-surface-2"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
