"use client";

import { useState } from "react";
import ChangeCard from "@/components/ChangeCard";
import type { ChangePriority, ChangeRequest } from "@/types/change";

type PriorityFilter = ChangePriority | "All";

type ChangeListProps = {
  changes: ChangeRequest[];
};

export default function ChangeList({ changes }: ChangeListProps) {
  const [selectedPriority, setSelectedPriority] =
    useState<PriorityFilter>("All");

  const filteredChanges = changes.filter((request) => {
    return selectedPriority === "All" || request.priority === selectedPriority;
  });

  return (
    <section>
      <div className="mb-6 flex flex-wrap gap-2">
        {(["All", "High", "Medium", "Low"] as const).map((priority) => (
          <button
            key={priority}
            onClick={() => setSelectedPriority(priority)}
            className={`rounded-lg px-4 py-2 ${
              selectedPriority === priority
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800"
            }`}
          >
            {priority}
          </button>
        ))}
      </div>

      <p className="mb-4 text-sm text-gray-600">
        Showing {filteredChanges.length} change requests
      </p>

      <div className="space-y-4">
        {filteredChanges.map((request) => (
          <ChangeCard
            key={request.id}
            title={request.title}
            priority={request.priority}
            requester={request.requester}
            status={request.status}
            description={request.description}
          />
        ))}
      </div>
    </section>
  );
}
