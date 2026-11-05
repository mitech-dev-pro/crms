import Link from "next/link";
import { Plus } from "lucide-react";
import ChangeList from "@/components/ChangeList";
import { changeRequests } from "@/data/changes";

export default function ChangesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Change Requests</h1>

          <p className="mt-1 text-sm text-gray-500">
            View and manage organizational change requests.
          </p>
        </div>

        <Link
          href="/changes/new"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-900"
        >
          <Plus size={18} />
          New Change Request
        </Link>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="mb-5 text-sm text-gray-500">
          {changeRequests.length} change requests
        </p>

        <ChangeList changes={changeRequests} />
      </div>
    </div>
  );
}
