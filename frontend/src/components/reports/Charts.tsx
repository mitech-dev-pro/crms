// Small, dependency-free charts for the Reports page, following the dataviz rules:
// thin marks with rounded data ends, a 2px gap between marks, recessive axes,
// text in text colours (never the series colour), a hover tooltip on every mark
// (native title), and a data table behind every chart.
import type { ReactNode } from "react";

/** Horizontal bars for one series (e.g. changes per department). One hue, values at the bar ends. */
export function BarList({ rows, format = String, label }: { rows: { name: string; value: number }[]; format?: (n: number) => string; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <figure aria-label={label}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name} className="grid grid-cols-[minmax(0,140px)_1fr_auto] items-center gap-3 text-sm" title={`${r.name}: ${format(r.value)}`}>
            <span className="truncate text-ink-2">{r.name}</span>
            <span className="h-2.5 rounded-r bg-surface-2">
              <span className="block h-full rounded-r bg-teal" style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 4 : 0 }} />
            </span>
            <span className="w-14 text-right font-bold text-ink tabular-nums">{format(r.value)}</span>
          </li>
        ))}
      </ul>
      <DataTable head={["Item", "Value"]} rows={rows.map((r) => [r.name, format(r.value)])} />
    </figure>
  );
}

type Month = { month: string; label: string; raised: number; successful: number; failed: number };

/** Monthly post-implementation outcomes as stacked columns; "raised" is printed above each month. */
export function MonthlyOutcome({ months }: { months: Month[] }) {
  const max = Math.max(1, ...months.map((m) => m.successful + m.failed));
  return (
    <figure aria-label="Monthly volume and outcome">
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-ink-2">
        <LegendItem color="var(--green-fg)">Successful</LegendItem>
        <LegendItem color="var(--red-fg)">Failed / rolled back</LegendItem>
        <span className="text-muted">Number above each month: changes raised</span>
      </div>
      <div className="flex h-44 items-end gap-3 border-b border-line-strong pb-px">
        {months.map((m) => {
          const total = m.successful + m.failed;
          return (
            <div key={m.month} className="flex h-full flex-1 flex-col items-center justify-end" title={`${m.label}: ${m.raised} raised · ${m.successful} successful · ${m.failed} failed or rolled back`}>
              <span className="mb-1 text-[11px] font-bold text-muted tabular-nums">{m.raised}</span>
              {/* Stack: failed on top, successful at the baseline, a 2px surface gap between them. */}
              <div className="flex w-full max-w-10 flex-col justify-end gap-[2px]" style={{ height: `${(total / max) * 80}%` }}>
                {m.failed > 0 && <span className="w-full rounded-t" style={{ flexGrow: m.failed, background: "var(--red-fg)" }} />}
                {m.successful > 0 && <span className={`w-full ${m.failed ? "" : "rounded-t"}`} style={{ flexGrow: m.successful, background: "var(--green-fg)" }} />}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-3">
        {months.map((m) => <span key={m.month} className="flex-1 text-center text-xs font-semibold text-muted">{m.label}</span>)}
      </div>
      <DataTable head={["Month", "Raised", "Successful", "Failed / rolled back"]} rows={months.map((m) => [m.label, m.raised, m.successful, m.failed])} />
    </figure>
  );
}

function LegendItem({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-sm" style={{ background: color }} /> {children}
    </span>
  );
}

/** The accessible "table view" of a chart, collapsed by default. */
function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer font-semibold text-muted hover:text-ink">Show data</summary>
      <table className="mt-2 w-full text-left">
        <thead>
          <tr className="text-muted">{head.map((h) => <th key={h} className="py-1 pr-3 font-bold">{h}</th>)}</tr>
        </thead>
        <tbody className="text-ink-2">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="py-0.5 pr-3 tabular-nums">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </details>
  );
}
