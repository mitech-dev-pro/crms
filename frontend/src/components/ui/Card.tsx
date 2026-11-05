import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-surface ${className}`}>{children}</section>;
}

export function CardHeader({ title, right }: { title: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <h2 className="text-sm font-extrabold text-ink">{title}</h2>
      {right && <div className="text-xs font-semibold text-muted">{right}</div>}
    </div>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </Card>
  );
}

/** Label/value rows, e.g. the facts panel on a change. */
export function Facts({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
          <dt className="text-muted">{r.label}</dt>
          <dd className="text-right font-semibold text-ink">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}
