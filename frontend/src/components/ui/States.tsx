import { ShieldX } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { ButtonLink } from "./Button";

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-16 text-sm font-semibold text-muted">
      <span className="size-5 animate-spin rounded-full border-2 border-teal border-t-transparent" />
      {label}
    </div>
  );
}

// ------------------------------------------------------------------ loading placeholders
// Grey shapes in the layout of what's coming, so the page doesn't jump when data arrives.

/** One grey block. Size it with classes, e.g. "h-4 w-32". */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none ${className}`} aria-hidden />;
}

/** Announced once to screen readers; the shapes inside are hidden from them. */
function Loading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={className}>
      {children}
    </div>
  );
}

// Fixed, varied widths so rows don't look like a barcode (and render the same every time).
const WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-2/5", "w-3/5"];

/** Rows of a table or list. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <Loading className="divide-y divide-line">
      <div className="flex gap-4 px-4 py-3">
        {Array.from({ length: cols }, (_, c) => <Skeleton key={c} className="h-3 flex-1" />)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }, (_, c) => (
            <div key={c} className="flex-1">
              <Skeleton className={`h-4 ${WIDTHS[(r + c) % WIDTHS.length]}`} />
              {c === 0 && <Skeleton className="mt-1.5 h-3 w-1/3" />}
            </div>
          ))}
        </div>
      ))}
    </Loading>
  );
}

/** A row of stat cards and two panels: the dashboard and reports. */
export function DashboardSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <Loading className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-4">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="mt-3 h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3"><Skeleton className="h-4 w-40" /></div>
            <TableSkeleton rows={4} cols={2} />
          </div>
        ))}
      </div>
    </Loading>
  );
}

/** A change's page: title, lifecycle, and the main and side panels. */
export function DetailSkeleton() {
  return (
    <Loading className="space-y-4">
      <div>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-2 h-7 w-2/3" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3 rounded-xl border border-line bg-surface p-5">
          {WIDTHS.map((w, i) => <Skeleton key={i} className={`h-4 ${w}`} />)}
        </div>
        <div className="space-y-3 rounded-xl border border-line bg-surface p-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </div>
    </Loading>
  );
}

/** A form in a card: the wizard. */
export function FormSkeleton() {
  return (
    <Loading className="space-y-4">
      <div className="flex gap-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-28 rounded-lg" />)}</div>
      <div className="space-y-5 rounded-xl border border-line bg-surface p-6">
        <Skeleton className="h-5 w-48" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </Loading>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-sm font-bold text-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Shows an API error. A 403 gets the friendly access-denied screen. */
export function ErrorState({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.status === 403) return <Forbidden message={error.message} />;
  if (error instanceof ApiError && error.status === 404) return <EmptyState title="Not found">{error.message}</EmptyState>;
  return (
    <div role="alert" className="rounded-xl border border-[var(--red-fg)]/30 bg-[var(--red-bg)] px-4 py-3 text-sm font-semibold text-[var(--red-fg)]">
      {error instanceof Error ? error.message : "Something went wrong"}
    </div>
  );
}

/** The 403 screen: your role can't open this page. */
export function Forbidden({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[var(--red-bg)] text-[var(--red-fg)]">
        <ShieldX size={26} />
      </div>
      <h1 className="text-xl font-extrabold text-ink">Access denied</h1>
      <p className="mt-2 text-sm text-muted">{message ?? "Your role doesn't have access to this page. Each role sees only the screens it needs."}</p>
      <ButtonLink href="/dashboard" variant="secondary" className="mt-6">
        Back to dashboard
      </ButtonLink>
    </div>
  );
}
