import { Suspense } from "react";
import { RequirePerm } from "@/components/layout/SessionGate";
import { Spinner } from "@/components/ui/States";
import ChangeListView from "./ChangeListView";

export default function ChangesPage() {
  return (
    <RequirePerm screen="changes">
      {/* The list reads its filters from the URL (useSearchParams), which needs Suspense. */}
      <Suspense fallback={<Spinner />}>
        <ChangeListView />
      </Suspense>
    </RequirePerm>
  );
}
