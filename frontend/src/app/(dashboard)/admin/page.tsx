"use client";

import { useState } from "react";
import ChangeTypesTab from "@/components/admin/ChangeTypesTab";
import DepartmentsTab from "@/components/admin/DepartmentsTab";
import RolesTab from "@/components/admin/RolesTab";
import UsersTab from "@/components/admin/UsersTab";
import WorkflowsTab from "@/components/admin/WorkflowsTab";
import { RequirePerm } from "@/components/layout/SessionGate";
import StandInsPanel from "@/components/standins/StandInsPanel";

// Tabs in the prototype's order.
const TABS = [
  ["depts", "Departments"],
  ["types", "Change types"],
  ["roles", "Roles & permissions"],
  ["workflows", "Approval workflows"],
  ["users", "Users & access"],
  ["standins", "Stand-ins"],
] as const;
type Tab = (typeof TABS)[number][0];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("depts");
  return (
    <RequirePerm screen="admin">
      <div className="space-y-4">
        <div role="tablist" aria-label="Administration" className="flex overflow-x-auto border-b border-line [scrollbar-width:none]">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`border-b-2 px-3 py-2.5 text-sm font-bold whitespace-nowrap ${tab === key ? "border-teal text-teal-strong" : "border-transparent text-ink-2 hover:text-ink"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {tab === "depts" && <DepartmentsTab />}
          {tab === "types" && <ChangeTypesTab />}
          {tab === "roles" && <RolesTab />}
          {tab === "workflows" && <WorkflowsTab />}
          {tab === "users" && <UsersTab />}
          {tab === "standins" && <StandInsPanel scope="all" />}
        </div>
      </div>
    </RequirePerm>
  );
}
