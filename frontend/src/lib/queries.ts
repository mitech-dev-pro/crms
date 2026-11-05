"use client";

// Every API call the UI makes, as TanStack Query hooks.
// Queries read and cache; mutations change data and then refresh the affected queries.
import type {
  AuditListResponse, AuditQuery, CalendarResponse, ChangeDetail, ChangeDraftInput, ChangeListQuery, ChangeListResponse,
  ChangeUpdateInput, DecisionInput, FreezeDto, FreezeInput, InboxResponse, LoginInput, MetaResponse, PirInput,
  ReportPeriod, ReportsResponse, RoutePreview, SessionUser, WorkflowsResponse,
} from "@crms/shared";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api } from "./api";

// Query keys: the cache's "addresses". Invalidating a prefix refetches everything under it.
export const keys = {
  me: ["me"] as const,
  meta: ["meta"] as const,
  changes: ["changes"] as const,
  changeList: (q: Partial<ChangeListQuery>) => ["changes", "list", q] as const,
  change: (ref: string) => ["changes", "detail", ref] as const,
  inbox: ["changes", "inbox"] as const,
  routePreview: (q: object) => ["route-preview", q] as const,
};

// ------------------------------------------------------------------ reads

export const useMe = () => useQuery({ queryKey: keys.me, queryFn: () => api<SessionUser>("/auth/me"), staleTime: 5 * 60_000 });

export const useMeta = () => useQuery({ queryKey: keys.meta, queryFn: () => api<MetaResponse>("/meta"), staleTime: 10 * 60_000 });

export const useChanges = (q: Partial<ChangeListQuery>, enabled = true) =>
  useQuery({
    queryKey: keys.changeList(q),
    queryFn: () => api<ChangeListResponse>("/changes", { query: q }),
    placeholderData: keepPreviousData, // keep showing the old page while the next one loads
    enabled,
  });

export const useChange = (ref: string, enabled = true) =>
  useQuery({ queryKey: keys.change(ref), queryFn: () => api<ChangeDetail>(`/changes/${ref}`), enabled: enabled && !!ref });

export const useInbox = (enabled = true) =>
  useQuery({ queryKey: keys.inbox, queryFn: () => api<InboxResponse>("/approvals/inbox"), enabled });

export type RoutePreviewQuery = { departmentId: string; impact: number; likelihood: number; emergency: boolean; plannedDate?: string };
export const useRoutePreview = (q: RoutePreviewQuery | null) =>
  useQuery({
    queryKey: keys.routePreview(q ?? {}),
    queryFn: () => api<RoutePreview>("/changes/route-preview", { query: q! }),
    enabled: !!q?.departmentId,
    placeholderData: keepPreviousData,
  });

export const useCalendar = (from: string, to: string) =>
  useQuery({ queryKey: ["calendar", from, to], queryFn: () => api<CalendarResponse>("/calendar", { query: { from, to } }), placeholderData: keepPreviousData });

export const useFreezes = () => useQuery({ queryKey: ["freezes"], queryFn: () => api<{ items: FreezeDto[] }>("/freezes") });

export const useWorkflows = () => useQuery({ queryKey: ["workflows"], queryFn: () => api<WorkflowsResponse>("/workflows") });

export const useReports = (period: ReportPeriod) =>
  useQuery({ queryKey: ["reports", period], queryFn: () => api<ReportsResponse>("/reports", { query: { period } }), placeholderData: keepPreviousData });

export const useAudit = (q: Partial<AuditQuery>) =>
  useQuery({ queryKey: ["audit", q], queryFn: () => api<AuditListResponse>("/audit", { query: q }), placeholderData: keepPreviousData });

/** Freezes change routing, so refresh anything that shows routes or dates too. */
function useFreezeMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [["freezes"], ["calendar"], keys.meta, ["route-preview"]]) qc.invalidateQueries({ queryKey: key });
    },
  });
}
export const useCreateFreeze = () => useFreezeMutation((v: FreezeInput) => api<FreezeDto>("/freezes", { method: "POST", body: v }));
export const useDeleteFreeze = () => useFreezeMutation((id: string) => api<void>(`/freezes/${id}`, { method: "DELETE" }));

/** Download URL for a CSV export with the given filters (the browser sends the session cookie). */
export const exportUrl = (path: string, query: Record<string, unknown> = {}) => {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== "").map(([k, v]) => [k, String(v)])).toString();
  return `/api${path}${qs ? `?${qs}` : ""}`;
};

// ------------------------------------------------------------------ auth

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api<SessionUser>("/auth/login", { method: "POST", body: input }),
    onSuccess: (user) => {
      qc.clear(); // drop anything cached for a previous user
      qc.setQueryData(keys.me, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>("/auth/logout", { method: "POST" }),
    onSettled: () => {
      qc.clear();
      // Full page load on purpose, so no state from the old session survives.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    },
  });
}

// ------------------------------------------------------------------ change actions

/** After any change action: put the fresh detail in the cache and refetch lists and the inbox. */
function useChangeMutation<V>(fn: (v: V) => Promise<ChangeDetail>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (detail) => {
      qc.setQueryData(keys.change(detail.ref), detail);
      qc.invalidateQueries({ queryKey: keys.changes, predicate: (q) => q.queryKey[1] !== "detail" });
    },
  });
}

export const useCreateChange = () =>
  useChangeMutation((v: ChangeDraftInput & { submit?: boolean; attest?: boolean }) => api<ChangeDetail>("/changes", { method: "POST", body: v }));

export const useUpdateChange = (ref: string) =>
  useChangeMutation((v: ChangeUpdateInput) => api<ChangeDetail>(`/changes/${ref}`, { method: "PATCH", body: v }));

export const useSubmitChange = (ref: string) =>
  useChangeMutation(() => api<ChangeDetail>(`/changes/${ref}/submit`, { method: "POST", body: { attest: true } }));

export const useDecision = (ref: string) =>
  useChangeMutation((v: DecisionInput) => api<ChangeDetail>(`/changes/${ref}/decision`, { method: "POST", body: v }));

export const useStartChange = (ref: string) =>
  useChangeMutation(() => api<ChangeDetail>(`/changes/${ref}/start`, { method: "POST" }));

export const useToggleTask = (ref: string) =>
  useChangeMutation((v: { taskId: string; done: boolean }) =>
    api<ChangeDetail>(`/changes/${ref}/tasks/${v.taskId}`, { method: "PATCH", body: { done: v.done } }),
  );

export const useMarkImplemented = (ref: string) =>
  useChangeMutation(() => api<ChangeDetail>(`/changes/${ref}/implemented`, { method: "POST" }));

export const useReview = (ref: string) =>
  useChangeMutation((v: PirInput) => api<ChangeDetail>(`/changes/${ref}/pir`, { method: "POST", body: v }));
