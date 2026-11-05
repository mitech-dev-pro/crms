"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ApiError } from "@/lib/api";

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
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
