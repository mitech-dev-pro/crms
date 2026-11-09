"use client";

// Every API call the UI makes, as TanStack Query hooks.
// Queries read and cache; mutations change data and then refresh the affected queries.
import type {
  AuditListResponse, AuditQuery, CalendarResponse, ChangeDetail, ChangeDraftInput, ChangeListQuery, ChangeListResponse,
  ChangeUpdateInput, DecisionInput, FreezeDto, FreezeInput, InboxResponse, LoginInput, MetaResponse, PirInput,
  ReportPeriod, ReportsResponse, RoutePreview, Role, SessionUser, StandInDto, StandInInput, WorkflowsResponse,
} from "@crms/shared";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api, apiUpload } from "./api";
import type { MutationFeedback } from "./toast";

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

/** from/to are only sent for period "custom". */
export const useReports = (period: ReportPeriod, from?: string, to?: string) => {
  const query = period === "custom" ? { period, from, to } : { period };
  return useQuery({ queryKey: ["reports", query], queryFn: () => api<ReportsResponse>("/reports", { query }), placeholderData: keepPreviousData });
};

export const useAudit = (q: Partial<AuditQuery>) =>
  useQuery({ queryKey: ["audit", q], queryFn: () => api<AuditListResponse>("/audit", { query: q }), placeholderData: keepPreviousData });

/** Freezes change routing, so refresh anything that shows routes or dates too. */
function useFreezeMutation<V, R>(fn: (v: V) => Promise<R>, meta: MutationFeedback) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta,
    onSuccess: () => {
      for (const key of [["freezes"], ["calendar"], keys.meta, ["route-preview"]]) qc.invalidateQueries({ queryKey: key });
    },
  });
}
export const useCreateFreeze = () => useFreezeMutation((v: FreezeInput) => api<FreezeDto>("/freezes", { method: "POST", body: v }), {
    success: (f: FreezeDto) => `Freeze window "${f.name}" added`,
    inlineError: true, // shown in the form
  });
export const useDeleteFreeze = () => useFreezeMutation((id: string) => api<void>(`/freezes/${id}`, { method: "DELETE" }), { success: "Freeze window removed" });

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
    meta: { inlineError: true },
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
    meta: { inlineError: true }, // we leave the page either way
    onSettled: () => {
      qc.clear();
      // Full page load on purpose, so no state from the old session survives.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    },
  });
}

// ------------------------------------------------------------------ change actions

const DECISION_DONE: Record<DecisionInput["kind"], string> = { approve: "Change approved", reject: "Change rejected", return: "Returned to the requester for rework" };

/** After any change action: put the fresh detail in the cache and refetch lists and the inbox. */
function useChangeMutation<V>(fn: (v: V) => Promise<ChangeDetail>, meta: MutationFeedback = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta,
    onSuccess: (detail) => {
      qc.setQueryData(keys.change(detail.ref), detail);
      qc.invalidateQueries({ queryKey: keys.changes, predicate: (q) => q.queryKey[1] !== "detail" });
    },
  });
}

export const useCreateChange = () =>
  useChangeMutation((v: ChangeDraftInput & { submit?: boolean; attest?: boolean }) => api<ChangeDetail>("/changes", { method: "POST", body: v }), { inlineError: true }); // wizard only: it reports errors and success itself

export const useUpdateChange = (ref: string) =>
  useChangeMutation((v: ChangeUpdateInput) => api<ChangeDetail>(`/changes/${ref}`, { method: "PATCH", body: v }), { inlineError: true });

/** The wizard passes its own feedback: it reports errors on the form itself. */
export const useSubmitChange = (ref: string, feedback: MutationFeedback = { success: "Submitted for approval" }) =>
  useChangeMutation(() => api<ChangeDetail>(`/changes/${ref}/submit`, { method: "POST", body: { attest: true } }), feedback);

export const useDecision = (ref: string) =>
  useChangeMutation((v: DecisionInput) => api<ChangeDetail>(`/changes/${ref}/decision`, { method: "POST", body: v }), {
    success: (_d: ChangeDetail, v: DecisionInput) => DECISION_DONE[v.kind],
    inlineError: true, // shown under the comment box
  });

export const useStartChange = (ref: string) =>
  useChangeMutation(() => api<ChangeDetail>(`/changes/${ref}/start`, { method: "POST" }), { success: "Implementation started" });

export const useToggleTask = (ref: string) =>
  useChangeMutation((v: { taskId: string; done: boolean }) =>
    api<ChangeDetail>(`/changes/${ref}/tasks/${v.taskId}`, { method: "PATCH", body: { done: v.done } }),
    { errorPrefix: "Task not updated" }, // no success message: the tick is its own feedback
  );

export const useMarkImplemented = (ref: string) =>
  useChangeMutation(() => api<ChangeDetail>(`/changes/${ref}/implemented`, { method: "POST" }), { success: "Marked as implemented" });

export const useReview = (ref: string) =>
  useChangeMutation((v: PirInput) => api<ChangeDetail>(`/changes/${ref}/pir`, { method: "POST", body: v }), {
    success: "Review recorded",
    inlineError: true, // shown in the review form
  });

export const useUploadAttachments = (ref: string) =>
  useChangeMutation((files: File[]) => apiUpload<ChangeDetail>(`/changes/${ref}/attachments`, files), {
    success: (_d: ChangeDetail, files: File[]) => (files.length === 1 ? `${files[0]!.name} uploaded` : `${files.length} files uploaded`),
    errorPrefix: "Upload failed",
  });

export const useRemoveAttachment = (ref: string) =>
  useChangeMutation((id: string) => api<ChangeDetail>(`/changes/${ref}/attachments/${id}`, { method: "DELETE" }), {
    success: "Attachment removed",
    errorPrefix: "Could not remove the file",
  });

export const useAddComment = (ref: string) =>
  useChangeMutation((body: string) => api<ChangeDetail>(`/changes/${ref}/comments`, { method: "POST", body: { body } }), {
    success: "Comment posted",
    inlineError: true, // shown under the comment box
  });

/** Download link for an attachment (the browser sends the session cookie). */
export const attachmentUrl = (ref: string, id: string) => `/api/changes/${ref}/attachments/${id}`;

// ------------------------------------------------------------------ notifications

export type Notice = { ref: string; title: string; reason: string };

/**
 * What needs this user's attention, by role, refreshed every minute:
 * approvers → their inbox; requesters → changes returned to them;
 * implementers → scheduled work; Change Manager → reviews due.
 */
export function useNotifications(me: SessionUser | undefined) {
  const every = { refetchInterval: 60_000 };
  const can = (s: string) => !!me?.permissions.includes(s as never);
  const inbox = useQuery({ queryKey: keys.inbox, queryFn: () => api<InboxResponse>("/approvals/inbox"), enabled: can("approvals"), ...every });
  const returned = useQuery({
    queryKey: keys.changeList({ requesterId: me?.id, status: "ReturnedForRework" }),
    queryFn: () => api<ChangeListResponse>("/changes", { query: { requesterId: me!.id, status: "ReturnedForRework", pageSize: 20 } }),
    enabled: !!me && can("changes"), ...every,
  });
  const toStart = useQuery({
    queryKey: keys.changeList({ implementerId: me?.id, status: "Scheduled" }),
    queryFn: () => api<ChangeListResponse>("/changes", { query: { implementerId: me!.id, status: "Scheduled", pageSize: 20 } }),
    enabled: me?.role === "implementer", ...every,
  });
  const toReview = useQuery({
    queryKey: keys.changeList({ status: "Implemented" }),
    queryFn: () => api<ChangeListResponse>("/changes", { query: { status: "Implemented", pageSize: 20 } }),
    enabled: me?.role === "changeManager", ...every,
  });

  const items: Notice[] = [
    ...(inbox.data?.items ?? []).map((c) => {
      const late = c.currentStage?.dueAt && new Date(c.currentStage.dueAt).getTime() < inbox.dataUpdatedAt; // "now" = when the inbox was fetched
      return { ref: c.ref, title: c.title, reason: `${late ? "Overdue · " : ""}Awaiting your decision · ${c.currentStage?.label ?? ""} stage` };
    }),
    ...(returned.data?.items ?? []).map((c) => ({ ref: c.ref, title: c.title, reason: "Returned to you for rework" })),
    ...(toStart.data?.items ?? []).map((c) => ({ ref: c.ref, title: c.title, reason: `Ready to implement · planned ${c.plannedDate ?? "—"}` })),
    ...(toReview.data?.items ?? []).map((c) => ({ ref: c.ref, title: c.title, reason: "Implemented · post-implementation review due" })),
  ];
  return { items, loading: inbox.isLoading || returned.isLoading };
}

// ------------------------------------------------------------------ stand-ins

/** "mine": cover I've arranged or am giving. "all": everyone's (admins and the Change Manager). */
export const useStandIns = (scope: "mine" | "all" = "mine") =>
  useQuery({ queryKey: ["stand-ins", scope], queryFn: () => api<{ items: StandInDto[] }>("/stand-ins", { query: scope === "all" ? { scope } : {} }) });

export type StandInCandidate = { id: string; name: string; role: Role; department: string };
export const useStandInCandidates = () =>
  useQuery({ queryKey: ["stand-ins", "candidates"], queryFn: () => api<{ items: StandInCandidate[] }>("/stand-ins/candidates"), staleTime: 5 * 60_000 });

/** Stand-ins change who can decide what, so refresh the inbox and changes too. */
function useStandInMutation<V, R>(fn: (v: V) => Promise<R>, meta: MutationFeedback) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    meta,
    onSuccess: () => {
      for (const key of [["stand-ins"], keys.inbox, keys.changes, ["audit"]]) qc.invalidateQueries({ queryKey: key });
    },
  });
}
export const useCreateStandIn = () =>
  useStandInMutation((v: StandInInput) => api<StandInDto>("/stand-ins", { method: "POST", body: v }), {
    success: (d: StandInDto) => `${d.to.name} will stand in for ${d.from.name}`,
    inlineError: true, // shown in the form
  });
export const useEndStandIn = () => useStandInMutation((id: string) => api<void>(`/stand-ins/${id}`, { method: "DELETE" }), { success: "Stand-in ended" });
