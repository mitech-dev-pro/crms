"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ClipboardCheck,
  CalendarDays,
  ShieldAlert,
  Settings,
  Layers3,
} from "lucide-react";

const navigationItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Change Requests",
    href: "/changes",
    icon: FileText,
  },
  {
    label: "My Approvals",
    href: "/approvals",
    icon: ClipboardCheck,
  },
  {
    label: "Change Calendar",
    href: "/calendar",
    icon: CalendarDays,
  },
  {
    label: "Risk Assessments",
    href: "/risks",
    icon: ShieldAlert,
  },
  {
    label: "Administration",
    href: "/admin",
    icon: Settings,
  },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-gray-200 bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-6">
        <div className="rounded-lg bg-emerald-800 p-2 text-white">
          <Layers3 size={20} />
        </div>

        <div>
          <h1 className="text-sm font-bold text-gray-900">MiLife Change Hub</h1>
          <p className="text-xs text-gray-500">Change Management</p>
        </div>
      </div>

      <nav className="space-y-1 p-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-emerald-50 text-emerald-800"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
