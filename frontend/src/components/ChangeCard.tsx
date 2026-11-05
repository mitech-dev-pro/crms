import type { ChangePriority, ChangeStatus } from "@/types/change";

type ChangeCardProps = {
  title: string;
  priority: ChangePriority;
  requester: string;
  status: ChangeStatus;
  description: string;
};

const priorityColors = {
  Low: "text-green-600",
  Medium: "text-yellow-600",
  High: "text-red-600",
};

export default function ChangeCard({
  title,
  priority,
  requester,
  status,
  description,
}: ChangeCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-gray-600">Requested by: {requester}</p>
      <p className={`mt-2 text-sm ${priorityColors[priority]} font-semibold`}>
        Priority: {priority}
      </p>
      <p className="text-sm">Status: {status}</p>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  );
}
