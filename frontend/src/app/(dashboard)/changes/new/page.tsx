import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ChangeRequestWizard from "@/components/changes/ChangeRequestWizard";

export default function NewChangePage() {
  return (
    <div className="max-w-4xl space-y-6">
      <Link
        href="/changes"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-emerald-800"
      >
        <ArrowLeft size={16} />
        Back to Change Requests
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Change Request</h1>

        <p className="mt-1 text-sm text-gray-500">
          Submit a request for an organizational change.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-6 text-lg font-semibold text-gray-900">
          Step 1: Basic Information
        </h2>

        <ChangeRequestWizard />
      </div>
    </div>
  );
}
