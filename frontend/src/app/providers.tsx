"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { Toaster } from "@/components/ui/Toaster";
import { ApiError } from "@/lib/api";
import { toast } from "@/lib/toast";

export default function Providers({ children }: { children: ReactNode }) {
  // One cache per browser tab. useState keeps it stable across re-renders.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000, // data counts as fresh for 15s, then refetches in the background
            refetchOnWindowFocus: true,
            // Don't retry errors that won't fix themselves (401, 403, 404, validation).
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
        // Feedback for every action in one place, driven by each mutation's `meta` (see lib/toast.ts).
        mutationCache: new MutationCache({
          onSuccess: (data, variables, _result, mutation) => {
            const s = mutation.meta?.success;
            if (s) toast.success(typeof s === "function" ? (s as (d: unknown, v: unknown) => string)(data, variables) : s);
          },
          onError: (error, _variables, _result, mutation) => {
            const meta = mutation.meta;
            if (meta?.inlineError) return;
            if (error instanceof ApiError && (error.status === 401 || error.code === "PASSWORD_CHANGE_REQUIRED")) return; // we're redirecting
            toast.error(meta?.errorPrefix ? `${meta.errorPrefix}: ${error.message}` : error.message);
          },
        }),
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <ConfirmProvider>
        {children}
        <Toaster />
      </ConfirmProvider>
    </QueryClientProvider>
  );
}
