"use client";

import {
  ROLES, ROLE_LABELS, USER_IMPORT_TEMPLATE, canAssignRole, userInviteSchema, PRIVILEGED_ROLES,
  type AdminUser, type Role, type UserImportResult, type UserInviteInput, type UserStatus,
} from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Copy, Download, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pill } from "@/components/ui/Badges";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Combobox } from "@/components/ui/Combobox";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Field, Input, Select } from "@/components/ui/Form";
import { Pagination } from "@/components/ui/Pagination";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { useAdminUsers, useImportUsers, useInviteUser, useResetPassword, useUpdateUser } from "@/lib/admin-queries";
import { exportUrl, useMe, useMeta } from "@/lib/queries";
import { parseCsv } from "./csv";

const STATUS_TONE = { Active: "green", Invited: "amber", Disabled: "gray" } as const;

export default function UsersTab() {
  const { data: me } = useMe();
  const meta = useMeta();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [departmentId, setDepartmentId] = useState("");
  const [status, setStatus] = useState<UserStatus | "">("");
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState<"none" | "invite" | "import">("none");
  const [tempPassword, setTempPassword] = useState<{ name: string; password: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(q.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const filters = { q: search || undefined, role: role || undefined, departmentId: departmentId || undefined, status: status || undefined };
  const users = useAdminUsers({ ...filters, page, pageSize: 15 });
  const update = useUpdateUser();
  const reset = useResetPassword();
  const confirm = useConfirm();
  const counts = users.data?.counts;

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-2 border-b border-line p-3 md:grid-cols-[minmax(0,1fr)_170px_190px]">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or code" aria-label="Search users" />
          <Select aria-label="Role" value={role} onChange={(e) => { setRole(e.target.value as Role | ""); setPage(1); }}>
            <option value="">All roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
          <Combobox
            aria-label="Department"
            value={departmentId}
            noneLabel="All departments"
            options={(meta.data?.departments ?? []).map((d) => ({ value: d.id, label: d.name, hint: d.code }))}
            onChange={(v) => { setDepartmentId(v ?? ""); setPage(1); }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          {(["", "Active", "Invited", "Disabled"] as const).map((s) => {
            const n = s ? counts?.[s] : counts && counts.Active + counts.Invited + counts.Disabled;
            return (
              <button key={s || "all"} onClick={() => { setStatus(s); setPage(1); }} aria-pressed={status === s}
                className={`rounded-full border px-3 py-1 text-xs font-bold ${status === s ? "border-navy bg-navy text-white" : "border-line-strong text-ink-2 hover:bg-surface-2"}`}>
                {s || "All"} {n !== undefined && <span className="opacity-70">{n}</span>}
              </button>
            );
          })}
          <div className="ml-auto flex flex-wrap gap-2">
            <a href={exportUrl("/admin/users/export.csv", filters)} className={buttonClass("secondary")} download><Download size={15} /> Export</a>
            <Button variant="secondary" onClick={() => setPanel(panel === "import" ? "none" : "import")}><Upload size={15} /> Import CSV</Button>
            <Button onClick={() => setPanel(panel === "invite" ? "none" : "invite")}>Add user</Button>
          </div>
        </div>

        {panel === "invite" && <InviteForm onDone={() => setPanel("none")} />}
        {panel === "import" && <ImportPanel onDone={() => setPanel("none")} />}

        {users.isPending ? <TableSkeleton rows={8} cols={6} /> : users.isError ? <div className="p-4"><ErrorState error={users.error} /></div> : !users.data.items.length ? (
          <EmptyState title="No users match these filters" />
        ) : (
          <div className={`overflow-x-auto ${users.isPlaceholderData ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase">
                  <th className="px-4 py-2.5">User</th>
                  <th className="px-4 py-2.5">Role</th>
                  <th className="px-4 py-2.5">Department</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Last sign-in</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.data.items.map((u) => (
                  <UserRow key={u.id} u={u} meRole={me!.role} isMe={u.id === me!.id} departments={meta.data?.departments ?? []}
                    onChange={async (v) => {
                      if (v.status === "Disabled") {
                        const ok = await confirm({
                          title: `Disable ${u.name}?`,
                          message: "They are signed out straight away and can't sign in until an admin enables them again.",
                          confirmLabel: "Disable user",
                          tone: "danger",
                        });
                        if (!ok) return;
                      }
                      update.mutate({ id: u.id, ...v });
                    }}
                    onReset={async () => {
                      const activating = u.status === "Invited";
                      const ok = await confirm({
                        title: activating ? `Activate ${u.name}?` : `Reset ${u.name}'s password?`,
                        message: `A one-time temporary password will be shown to you once. ${activating ? "" : "Their current password stops working and they are signed out. "}They must choose a new password when they sign in.`,
                        confirmLabel: activating ? "Activate" : "Reset password",
                        tone: activating ? "default" : "danger",
                      });
                      if (ok) reset.mutate(u.id, { onSuccess: (r) => setTempPassword({ name: u.name, password: r.temporaryPassword }) });
                    }}
                  />
                ))}
              </tbody>
            </table>
            <Pagination page={users.data.page} pageSize={users.data.pageSize} total={users.data.total} onPage={setPage} />
          </div>
        )}
      </Card>
      {tempPassword && <PasswordDialog {...tempPassword} onClose={() => setTempPassword(null)} />}
    </div>
  );
}

function UserRow({ u, meRole, isMe, departments, onChange, onReset }: {
  u: AdminUser; meRole: Role; isMe: boolean; departments: { id: string; name: string }[];
  onChange: (v: { role?: Role; departmentId?: string; status?: "Active" | "Disabled" }) => void; onReset: () => void;
}) {
  // Mirrors the API's rules so the controls are disabled up front. The API still decides.
  const locked = isMe || (PRIVILEGED_ROLES.includes(u.role) && meRole !== "superAdmin");
  const lockReason = isMe ? "You can't change your own account" : locked ? "Only a super admin can change an admin account" : undefined;
  return (
    <tr>
      <td className="px-4 py-2.5">
        <p className="font-bold text-ink">{u.name}{isMe && <span className="ml-1 text-xs font-semibold text-muted">(you)</span>}</p>
        <p className="text-xs text-muted">{u.email} · <span className="font-mono">{u.code}</span></p>
      </td>
      <td className="w-48 px-4 py-2.5">
        <Select aria-label={`Role of ${u.name}`} value={u.role} disabled={locked} title={lockReason} onChange={(e) => onChange({ role: e.target.value as Role })}>
          {ROLES.filter((r) => r === u.role || canAssignRole(meRole, u.role, r)).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
      </td>
      <td className="w-48 px-4 py-2.5">
        <Combobox
          aria-label={`Department of ${u.name}`}
          value={u.department.id}
          disabled={locked}
          title={lockReason}
          options={[
            ...(departments.some((d) => d.id === u.department.id) ? [] : [{ value: u.department.id, label: u.department.name }]),
            ...departments.map((d) => ({ value: d.id, label: d.name })),
          ]}
          onChange={(v) => v && v !== u.department.id && onChange({ departmentId: v })}
        />
      </td>
      <td className="px-4 py-2.5"><Pill tone={STATUS_TONE[u.status]}>{u.status}</Pill></td>
      <td className="px-4 py-2.5 whitespace-nowrap text-ink-2">{u.lastLoginAt ? <RelativeTime iso={u.lastLoginAt} /> : "Never"}</td>
      <td className="px-4 py-2.5">
        <div className="flex justify-end gap-2">
          {u.status !== "Invited" && (
            <Button variant={u.status === "Active" ? "danger" : "secondary"} className="px-3 py-1 text-xs" disabled={locked} title={lockReason}
              onClick={() => onChange({ status: u.status === "Active" ? "Disabled" : "Active" })}>
              {u.status === "Active" ? "Disable" : "Enable"}
            </Button>
          )}
          <Button variant="secondary" className="px-3 py-1 text-xs" disabled={locked || u.status === "Disabled"} title={lockReason ?? (u.status === "Disabled" ? "Enable the user first" : undefined)} onClick={onReset}>
            {u.status === "Invited" ? "Activate" : "Reset password"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const { data: me } = useMe();
  const meta = useMeta();
  const invite = useInviteUser();
  const { register, handleSubmit, control, formState: { errors } } = useForm<UserInviteInput>({ resolver: zodResolver(userInviteSchema), defaultValues: { role: "requester" } });
  return (
    <form onSubmit={handleSubmit((v) => invite.mutate(v, { onSuccess: onDone }))} noValidate className="grid gap-3 border-b border-line bg-surface-2 p-4 md:grid-cols-[1fr_1fr_170px_170px_auto] md:items-end">
      <Field label="Name" htmlFor="inv-name" error={errors.name?.message}><Input id="inv-name" invalid={!!errors.name} {...register("name")} /></Field>
      <Field label="Email" htmlFor="inv-email" error={errors.email?.message ?? invite.error?.message}><Input id="inv-email" type="email" invalid={!!errors.email} {...register("email")} /></Field>
      <Field label="Department" htmlFor="inv-dept" error={errors.departmentId?.message}>
        <Controller
          name="departmentId"
          control={control}
          render={({ field }) => (
            <Combobox
              id="inv-dept"
              value={field.value}
              onChange={(v) => field.onChange(v ?? "")}
              onBlur={field.onBlur}
              invalid={!!errors.departmentId}
              placeholder="Search departments"
              options={(meta.data?.departments ?? []).map((d) => ({ value: d.id, label: d.name, hint: d.code }))}
            />
          )}
        />
      </Field>
      <Field label="Role" htmlFor="inv-role">
        <Select id="inv-role" {...register("role")}>
          {ROLES.filter((r) => me && canAssignRole(me.role, "requester", r)).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
      </Field>
      <Button type="submit" loading={invite.isPending}>Invite</Button>
      <p className="text-xs text-muted md:col-span-5">The user starts as <b>Invited</b>. Use <b>Activate</b> on their row to give them a one-time temporary password.</p>
    </form>
  );
}

function ImportPanel({ onDone }: { onDone: () => void }) {
  const importer = useImportUsers();
  const [rows, setRows] = useState<{ name: string; email: string; department: string; role: string }[] | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [preview, setPreview] = useState<UserImportResult | null>(null);
  const templateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(USER_IMPORT_TEMPLATE)}`;

  const onFile = async (file: File | undefined) => {
    setPreview(null);
    setFileError(null);
    if (!file) return;
    const table = parseCsv(await file.text());
    const header = table[0]?.map((h) => h.trim().toLowerCase()) ?? [];
    const col = (name: string) => header.indexOf(name);
    if (["name", "email", "department", "role"].some((c) => col(c) < 0)) {
      setFileError("The first row must have the columns: name, email, department, role (download the template).");
      return;
    }
    const parsed = table.slice(1).map((r) => ({ name: r[col("name")] ?? "", email: r[col("email")] ?? "", department: r[col("department")] ?? "", role: r[col("role")] ?? "" }));
    setRows(parsed);
    // Check first, change nothing: the server validates every row and reports back.
    importer.mutate({ rows: parsed, dryRun: true }, { onSuccess: setPreview });
  };

  const valid = preview?.results.filter((r) => r.ok).length ?? 0;

  return (
    <div className="space-y-3 border-b border-line bg-surface-2 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input type="file" accept=".csv,text/csv" aria-label="CSV file" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm text-ink-2 file:mr-3 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-bold" />
        <a href={templateHref} download="crms-users-template.csv" className="text-sm font-bold text-teal hover:underline">CSV template</a>
      </div>
      <p className="text-xs text-muted">Columns: name, email, department (name or code), role (e.g. Requester or requester). Users are created as Invited. Nothing is saved until you confirm.</p>
      {fileError && <p className="text-xs font-semibold text-danger">{fileError}</p>}
      {importer.error && <p className="text-xs font-semibold text-danger">{importer.error.message}</p>}

      {preview && (
        <>
          <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-surface text-sm">
            {preview.results.map((r) => (
              <li key={r.row} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="w-14 text-xs text-muted">Row {r.row}</span>
                <span className="font-semibold text-ink">{r.email || "(no email)"}</span>
                {r.ok ? <Pill tone="green">{preview.dryRun ? "Ready" : "Created"}</Pill> : <span className="text-xs font-semibold text-danger">{r.errors.join(" · ")}</span>}
              </li>
            ))}
          </ul>
          {preview.dryRun ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={!valid || !rows} loading={importer.isPending} onClick={() => rows && importer.mutate({ rows, dryRun: false }, { onSuccess: setPreview })}>
                Import {valid} valid {valid === 1 ? "user" : "users"}
              </Button>
              {valid < preview.results.length && <span className="text-xs text-muted">{preview.results.length - valid} rows will be skipped.</span>}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: "var(--green-fg)" }}>Imported {preview.created} users.</span>
              <Button variant="secondary" onClick={onDone}>Done</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Shows the temporary password exactly once. Closing the dialog forgets it. */
function PasswordDialog({ name, password, onClose }: { name: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="pw-title">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <Card className="relative w-full max-w-md p-5">
        <h2 id="pw-title" className="text-base font-extrabold text-ink">Temporary password for {name}</h2>
        <p className="mt-1 text-sm text-muted">Give it to {name.split(" ")[0]} securely (not by email). It won&apos;t be shown again.</p>
        <div className="mt-4 flex items-center gap-2">
          <code className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-base text-ink select-all">{password}</code>
          <Button variant="secondary" onClick={() => navigator.clipboard?.writeText(password).then(() => setCopied(true))}>
            <Copy size={14} /> {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <div className="mt-5 flex justify-end"><Button onClick={onClose}>Done</Button></div>
      </Card>
    </div>
  );
}
