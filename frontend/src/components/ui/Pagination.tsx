import { ChevronLeft, ChevronRight } from "lucide-react";

/** "Showing 1–10 of 39" with prev/next and page numbers (1 … 4 5 6 … 12). */
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums.at(-1) !== "…") nums.push("…");
  }
  const start = total ? (page - 1) * pageSize + 1 : 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-sm">
      <span className="text-muted">{total ? `Showing ${start}–${Math.min(page * pageSize, total)} of ${total}` : "No results"}</span>
      <div className="flex items-center gap-1">
        <PageButton disabled={page <= 1} onClick={() => onPage(page - 1)} label="Previous page">
          <ChevronLeft size={16} />
        </PageButton>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`gap${i}`} className="px-2 text-faint">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onPage(n)}
              aria-current={n === page ? "page" : undefined}
              className={`min-w-8 rounded-md px-2 py-1 font-bold ${n === page ? "bg-navy text-white" : "text-ink-2 hover:bg-surface-2"}`}
            >
              {n}
            </button>
          ),
        )}
        <PageButton disabled={page >= pages} onClick={() => onPage(page + 1)} label="Next page">
          <ChevronRight size={16} />
        </PageButton>
      </div>
    </div>
  );
}

function PageButton({ disabled, onClick, label, children }: { disabled: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button disabled={disabled} onClick={onClick} aria-label={label} className="rounded-md p-1.5 text-ink-2 hover:bg-surface-2 disabled:opacity-40">
      {children}
    </button>
  );
}
