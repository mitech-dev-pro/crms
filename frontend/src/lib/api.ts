import type { ApiErrorBody } from "@crms/shared";

/** Any non-2xx API response, carrying the server's error code and field messages. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Options = { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; query?: Record<string, unknown> };

/**
 * Calls the Express API through Next's /api rewrite.
 * Sends the session cookie, parses JSON, and turns error responses into ApiError.
 */
export async function api<T>(path: string, { method = "GET", body, query }: Options = {}): Promise<T> {
  const qs = query
    ? "?" + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString()
    : "";

  const res = await fetch(`/api${path}${qs}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = (data as Partial<ApiErrorBody>).error;
    // Session expired or missing: back to login, then return here afterwards.
    if (res.status === 401 && !path.startsWith("/auth/")) {
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      // A full page load on purpose: it wipes every cached query from the old session.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/login?next=${next}`);
    }
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? `Request failed (${res.status})`, err?.fields);
  }
  return data as T;
}
