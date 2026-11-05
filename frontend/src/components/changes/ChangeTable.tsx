import type { ChangeListItem } from "@crms/shared";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { Mono, RiskBadge, StatusBadge } from "../ui/Badges";
import { EmptyState } from "../ui/States";

/**
 * Change list as a table when there's room, stacked rows when there isn't. Rows link to the detail page.
 * "Room" is the width of the surrounding card (a container query, @container), not the screen,
 * so it also fits half-width cards such as the dashboard's.
 */
export default function ChangeTable({ items, empty = "No change requests" }: { items: ChangeListItem[]; empty?: string }) {
  if (!items.length) return <EmptyState title={empty} />;

  return (
    <div className="@container">
      <table className="hidden w-full table-fixed text-sm @3xl:table">
        <colgroup>
          <col className="w-36" />
          <col />
          <col className="w-28" />
          <col className="w-32" />
          <col className="w-40" />
        </colgroup>
        <thead>
          <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase">
            <th className="px-4 py-2.5">Reference</th>
            <th className="px-4 py-2.5">Title</th>
            <th className="px-4 py-2.5">Risk</th>
            <th className="px-4 py-2.5">Planned</th>
            <th className="px-4 py-2.5 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {items.map((c) => (
            <tr key={c.id} className="group hover:bg-surface-2">
              <td className="px-4 py-3 align-top">
                <Mono>{c.ref}</Mono>
              </td>
              <td className="px-4 py-3">
                <Link href={`/changes/${c.ref}`} className="block truncate font-bold text-ink group-hover:text-teal-strong">
                  {c.title}
                </Link>
                <p className="truncate text-xs text-muted">
                  {c.department.name} · {c.currentStage ? `Awaiting ${c.currentStage.label}` : c.type.label}
                </p>
              </td>
              <td className="px-4 py-3 align-top">
                <RiskBadge risk={c.tier === "Emergency" ? "Emergency" : c.risk} />
              </td>
              <td className="px-4 py-3 align-top whitespace-nowrap text-ink-2">{formatDate(c.plannedDate)}</td>
              <td className="px-4 py-3 text-right align-top">
                <StatusBadge status={c.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-line @3xl:hidden">
        {items.map((c) => (
          <li key={c.id}>
            <Link href={`/changes/${c.ref}`} className="block px-4 py-3 hover:bg-surface-2">
              <div className="flex items-center justify-between gap-2">
                <Mono>{c.ref}</Mono>
                <StatusBadge status={c.status} />
              </div>
              <p className="mt-1 truncate font-bold text-ink">{c.title}</p>
              <p className="truncate text-xs text-muted">
                {c.department.name} · {c.currentStage ? `Awaiting ${c.currentStage.label}` : formatDate(c.plannedDate)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
