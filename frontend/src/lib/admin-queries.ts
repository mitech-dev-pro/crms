"use client";

// Administration API hooks. After any change, refresh admin lists and anything
// that shows departments, types, users or routes elsewhere in the app.
import type {
  AdminChangeType, AdminDepartment, AdminUser, AdminUserListResponse, ChangeTypeCreateInput, ChangeTypeUpdateInput,
  DepartmentCreateInput, DepartmentUpdateInput, UserImportInput, UserImportResult, UserInviteInput, UserListQuery,
  UserUpdateInput, WorkflowUpdateInput,
} from "@crms/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { keys } from "./queries";

export const useAdminDepartments = () =>
  useQuery({ queryKey: ["admin", "departments"], queryFn: () => api<{ items: AdminDepartment[] }>("/admin/departments") });

export const useAdminChangeTypes = () =>
  useQuery({ queryKey: ["admin", "change-types"], queryFn: () => api<{ items: AdminChangeType[] }>("/admin/change-types") });

export const useAdminUsers = (q: Partial<UserListQuery>) =>
  useQuery({ queryKey: ["admin", "users", q], queryFn: () => api<AdminUserListResponse>("/admin/users", { query: q }), placeholderData: keepPreviousData });

function useAdminMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const key of [["admin"], keys.meta, ["workflows"], ["route-preview"], ["audit"]]) qc.invalidateQueries({ queryKey: key });
    },
  });
}

export const useCreateDepartment = () => useAdminMutation((v: DepartmentCreateInput) => api("/admin/departments", { method: "POST", body: v }));
export const useUpdateDepartment = () =>
  useAdminMutation(({ id, ...v }: DepartmentUpdateInput & { id: string }) => api(`/admin/departments/${id}`, { method: "PATCH", body: v }));

export const useCreateChangeType = () => useAdminMutation((v: ChangeTypeCreateInput) => api("/admin/change-types", { method: "POST", body: v }));
export const useUpdateChangeType = () =>
  useAdminMutation(({ id, ...v }: ChangeTypeUpdateInput & { id: string }) => api(`/admin/change-types/${id}`, { method: "PATCH", body: v }));

export const useInviteUser = () => useAdminMutation((v: UserInviteInput) => api<AdminUser>("/admin/users", { method: "POST", body: v }));
export const useUpdateUser = () => useAdminMutation(({ id, ...v }: UserUpdateInput & { id: string }) => api<AdminUser>(`/admin/users/${id}`, { method: "PATCH", body: v }));
export const useResetPassword = () =>
  useAdminMutation((id: string) => api<{ temporaryPassword: string }>(`/admin/users/${id}/reset-password`, { method: "POST" }));
export const useImportUsers = () => useAdminMutation((v: UserImportInput) => api<UserImportResult>("/admin/users/import", { method: "POST", body: v }));

export const useUpdateWorkflow = () => useAdminMutation((v: WorkflowUpdateInput) => api<void>("/admin/workflows", { method: "PUT", body: v }));
