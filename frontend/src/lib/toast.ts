// Short messages in the corner ("Change approved", "Upload failed: …").
// A tiny store outside React, so anything can raise one: components, the
// React Query mutation cache, plain functions. <Toaster> renders them.

export type ToastTone = "success" | "error" | "info";
export type Toast = { id: number; tone: ToastTone; message: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function show(tone: ToastTone, message: string, ms = tone === "error" ? 8000 : 4000) {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, tone, message }]; // at most 4 on screen
  notify();
  setTimeout(() => dismiss(id), ms);
  return id;
}

function dismiss(id: number) {
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export const toast = {
  success: (message: string) => show("success", message),
  error: (message: string) => show("error", message),
  info: (message: string) => show("info", message),
  dismiss,
  /** For useSyncExternalStore. */
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
  snapshot: () => toasts,
};

// ------------------------------------------------------------------ mutation feedback

/**
 * Per-mutation feedback, read by the mutation cache in providers.tsx:
 * - success: message shown when it works (a function can use the result and the input).
 * - errorPrefix: put before the server's message, e.g. "Upload failed".
 * - inlineError: the screen shows the error itself (next to a form), so no toast.
 */
export type MutationFeedback = {
  success?: string | ((data: never, variables: never) => string);
  errorPrefix?: string;
  inlineError?: boolean;
};

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: MutationFeedback & Record<string, unknown>;
  }
}
