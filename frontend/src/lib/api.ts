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

type Options = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; query?: Record<string, unknown> };

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

  return handle<T>(res, path);
}

/** Uploads files as multipart/form-data (field "files"). The browser sets the boundary header itself. */
export async function apiUpload<T>(path: string, files: File[]): Promise<T> {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const res = await fetch(`/api${path}`, { method: "POST", credentials: "include", body: form });
  return handle<T>(res, path);
}

async function handle<T>(res: Response, path: string): Promise<T> {
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
    // Signed in with a temporary password: the API allows nothing else until it's changed.
    if (res.status === 403 && err?.code === "PASSWORD_CHANGE_REQUIRED" && window.location.pathname !== "/change-password") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/change-password");
    }
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? `Request failed (${res.status})`, err?.fields);
  }
  return data as T;
}
