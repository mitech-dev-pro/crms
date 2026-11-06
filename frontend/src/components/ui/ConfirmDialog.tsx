"use client";

import { AlertTriangle, HelpCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

export type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  /** Text of the confirm button, e.g. "Disable user". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" makes the confirm button red and puts focus on Cancel, the safe choice. */
  tone?: "danger" | "default";
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null);

/**
 * Ask before doing something. Resolves true if confirmed, false if cancelled.
 *
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Disable Ama Mensah?", tone: "danger", confirmLabel: "Disable" })) …
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}

/** Holds the one confirm dialog for the app. Uses the native <dialog>: focus is trapped and Escape cancels. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending({ ...o, resolve });
      }),
    [],
  );

  useEffect(() => {
    if (pending && !dialog.current?.open) dialog.current?.showModal();
  }, [pending]);

  const finish = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
    dialog.current?.close();
  };

  const danger = pending?.tone === "danger";
  const Icon = danger ? AlertTriangle : HelpCircle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <dialog
        ref={dialog}
        aria-labelledby="confirm-title"
        aria-describedby={pending?.message ? "confirm-message" : undefined}
        onCancel={(e) => {
          e.preventDefault(); // Escape: close through finish so the promise resolves
          finish(false);
        }}
        onClick={(e) => e.target === dialog.current && finish(false)} // click on the backdrop
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-[#0d1322]/50 backdrop:backdrop-blur-[2px]"
      >
        {pending && (
          <div className="p-5">
            <div className="flex gap-3">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-full"
                style={{ background: `var(--${danger ? "red" : "blue"}-bg)`, color: `var(--${danger ? "red" : "blue"}-fg)` }}
              >
                <Icon size={20} />
              </span>
              <div className="min-w-0">
                <h2 id="confirm-title" className="text-base font-extrabold text-ink">{pending.title}</h2>
                {pending.message && <div id="confirm-message" className="mt-1 text-sm text-muted">{pending.message}</div>}
              </div>
            </div>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" autoFocus={danger} onClick={() => finish(false)}>{pending.cancelLabel ?? "Cancel"}</Button>
              <Button variant={danger ? "destructive" : "primary"} autoFocus={!danger} onClick={() => finish(true)}>
                {pending.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </ConfirmContext.Provider>
  );
}
