"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useSyncExternalStore } from "react";
import { toast, type Toast, type ToastTone } from "@/lib/toast";

const EMPTY: Toast[] = [];
const ICON: Record<ToastTone, typeof Info> = { success: CheckCircle2, error: XCircle, info: Info };
const COLOUR: Record<ToastTone, string> = { success: "var(--green-fg)", error: "var(--red-fg)", info: "var(--blue-fg)" };

/** Renders the toast stack, bottom-right (bottom-centre on phones). Mounted once in providers.tsx. */
export function Toaster() {
  const items = useSyncExternalStore(toast.subscribe, toast.snapshot, () => EMPTY);
  return (
    // Polite live region: screen readers read new messages without interrupting.
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:right-4 sm:left-auto sm:items-end">
      {items.map((t) => {
        const Icon = ICON[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-sm shadow-lg"
            style={{ borderLeft: `4px solid ${COLOUR[t.tone]}` }}
          >
            <Icon size={18} className="mt-px shrink-0" style={{ color: COLOUR[t.tone] }} aria-hidden />
            <p className="flex-1 font-semibold text-ink">{t.message}</p>
            <button onClick={() => toast.dismiss(t.id)} aria-label="Dismiss" className="-m-1 rounded p-1 text-muted hover:bg-surface-2 hover:text-ink">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
