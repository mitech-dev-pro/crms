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
