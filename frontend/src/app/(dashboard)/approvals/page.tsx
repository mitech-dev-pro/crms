"use client";

import ChangeTable from "@/components/changes/ChangeTable";
import { RequirePerm } from "@/components/layout/SessionGate";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState, Spinner } from "@/components/ui/States";
import { useInbox } from "@/lib/queries";

export default function ApprovalsPage() {
  return (
    <RequirePerm screen="approvals">
      <Inbox />
    </RequirePerm>
  );
}

function Inbox() {
  const inbox = useInbox();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Changes waiting at your stage. You can only decide when it&apos;s your turn, and never on a change you raised.
      </p>
      <Card>
        <CardHeader title="Awaiting your decision" right={inbox.data ? `${inbox.data.items.length} items` : undefined} />
        {inbox.isPending ? <Spinner /> : inbox.isError ? <div className="p-4"><ErrorState error={inbox.error} /></div> : (
          <ChangeTable items={inbox.data.items} empty="Nothing is waiting for you" />
        )}
      </Card>
    </div>
  );
}
