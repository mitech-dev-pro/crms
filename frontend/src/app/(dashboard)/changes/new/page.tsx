"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ChangeRequestWizard from "@/components/changes/wizard/ChangeRequestWizard";
import { RequirePerm } from "@/components/layout/SessionGate";
import { FormSkeleton } from "@/components/ui/States";

// /changes/new            → new request
// /changes/new?edit=REF   → edit a draft or returned request
// /changes/new?copy=REF   → a new request pre-filled from an existing one
export default function NewChangePage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <WithParams />
    </Suspense>
  );
}

function WithParams() {
  const params = useSearchParams();
  const editRef = params.get("edit") ?? undefined;
  const copyFrom = editRef ? undefined : params.get("copy") ?? undefined;
  // Editing goes through the "changes" screen (requesters own their drafts); creating needs "new".
  return (
    <RequirePerm screen={editRef ? "changes" : "new"}>
      <ChangeRequestWizard editRef={editRef} copyFrom={copyFrom} />
    </RequirePerm>
  );
}
