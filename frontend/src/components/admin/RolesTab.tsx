import { PERMS, ROLES, ROLE_LABELS, SCREENS, type Screen } from "@crms/shared";
import { Check } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";

const SCREEN_LABELS: Record<Screen, string> = {
  dashboard: "Dashboard", changes: "Change requests", new: "New request", approvals: "My approvals", calendar: "Calendar",
  flows: "Process flows", reports: "Reports", audit: "Audit trail", admin: "Administration",
};

/** Read-only view of the shared permissions table, the same one the API enforces. */
export default function RolesTab() {
  return (
    <Card>
      <CardHeader title="Roles & permissions" right="Read-only" />
      <p className="px-4 pt-3 text-sm text-muted">
        Which screens each role can open. This table lives in code (<code className="font-mono text-xs">packages/shared/src/enums.ts</code>) and the API enforces it on every
        request. Least privilege: each role sees only what it needs.
      </p>
      <div className="overflow-x-auto p-4">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-xs font-bold text-muted">
              <th className="py-2 pr-3">Role</th>
              {SCREENS.map((s) => <th key={s} className="px-2 py-2 text-center">{SCREEN_LABELS[s]}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ROLES.map((r) => (
              <tr key={r}>
                <th scope="row" className="py-2 pr-3 text-left font-bold text-ink">{ROLE_LABELS[r]}</th>
                {SCREENS.map((s) => (
                  <td key={s} className="px-2 py-2 text-center">
                    {PERMS[r].includes(s) ? <Check size={16} className="mx-auto text-teal" aria-label="Allowed" /> : <span className="text-faint" aria-label="Not allowed">·</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <ul className="mt-4 space-y-1 text-xs text-muted">
          <li>• Nobody can approve a change they raised (segregation of duties). A super admin can override only that case, with a recorded reason.</li>
          <li>• Only a super admin can grant or remove the System Admin and Super Admin roles. Nobody can change their own role.</li>
        </ul>
      </div>
    </Card>
  );
}
