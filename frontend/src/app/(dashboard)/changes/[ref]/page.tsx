import { Suspense } from "react";
import ChangeDetailView from "@/components/changes/detail/ChangeDetailView";
import { RequirePerm } from "@/components/layout/SessionGate";
import { DetailSkeleton } from "@/components/ui/States";

// The URL holds the reference, e.g. /changes/CHG-2026-0142.
// `params` is a Promise in this Next version; reading it inside Suspense keeps
// the rest of the page prerenderable (Cache Components).
export default function ChangePage({ params }: PageProps<"/changes/[ref]">) {
  return (
    <RequirePerm screen="changes">
      <Suspense fallback={<DetailSkeleton />}>
        <FromParams params={params} />
      </Suspense>
    </RequirePerm>
  );
}

async function FromParams({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return <ChangeDetailView changeRef={decodeURIComponent(ref)} />;
}
