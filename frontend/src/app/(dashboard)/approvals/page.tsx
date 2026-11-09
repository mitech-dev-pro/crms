"use client";

import ChangeTable from "@/components/changes/ChangeTable";
import { RequirePerm } from "@/components/layout/SessionGate";
import StandInsPanel from "@/components/standins/StandInsPanel";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState, TableSkeleton } from "@/components/ui/States";
import { useInbox, useMe } from "@/lib/queries";

export default function ApprovalsPage() {
  return (
    <RequirePerm screen="approvals">
      <Inbox />
    </RequirePerm>
  );
}

function Inbox() {
  const inbox = useInbox();
  const { data: me } = useMe();
  // The Change Manager (and super admin) can arrange cover for anyone, not just themselves.
  const manager = me?.role === "changeManager" || me?.role === "superAdmin";
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Changes waiting at your stage, or at a stage you&apos;re covering as a stand-in. You can only decide when it&apos;s your turn, and never on a
        change you raised. Decisions are due within 2 working days.
      </p>
      <Card>
        <CardHeader title="Awaiting your decision" right={inbox.data ? `${inbox.data.items.length} items` : undefined} />
        {inbox.isPending ? <TableSkeleton rows={4} /> : inbox.isError ? <div className="p-4"><ErrorState error={inbox.error} /></div> : (
          <ChangeTable items={inbox.data.items} empty="Nothing is waiting for you" showDue />
        )}
      </Card>
      <StandInsPanel scope={manager ? "all" : "mine"} />
    </div>
  );
}
