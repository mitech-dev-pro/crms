import { changeRequests } from "@/data/changes";
import StatCard from "@/components/StatCard";
import ChangeList from "@/components/ChangeList";

export default function DashboardPage() {
  const totalRequests = changeRequests.length;

  const pendingRequests = changeRequests.filter(
    (request) => request.status === "Pending",
  ).length;

  const highPriorityRequests = changeRequests.filter(
    (request) => request.priority === "High",
  ).length;

  const completedRequests = changeRequests.filter(
    (request) => request.status === "Completed",
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor and manage organizational changes.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Total Changes" value={totalRequests} />
        <StatCard title="Pending" value={pendingRequests} />
        <StatCard title="High Priority" value={highPriorityRequests} />
        <StatCard title="Completed" value={completedRequests} />
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Change Requests
          </h2>
          <p className="text-sm text-gray-500">
            Review and filter submitted changes.
          </p>
        </div>

        <ChangeList changes={changeRequests} />
      </section>
    </div>
  );
}
