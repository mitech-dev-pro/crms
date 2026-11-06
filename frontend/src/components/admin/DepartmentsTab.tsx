"use client";

import { departmentCreateSchema, type AdminDepartment, type DepartmentCreateInput } from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Mono, Pill } from "@/components/ui/Badges";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Combobox } from "@/components/ui/Combobox";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Field, Input } from "@/components/ui/Form";
import { ErrorState, TableSkeleton } from "@/components/ui/States";
import { useAdminDepartments, useAdminUsers, useCreateDepartment, useUpdateDepartment } from "@/lib/admin-queries";

export default function DepartmentsTab() {
  const depts = useAdminDepartments();
  const people = useAdminUsers({ status: "Active", pageSize: 100 }); // candidates for head / line manager
  const update = useUpdateDepartment();
  const confirm = useConfirm();
  const [adding, setAdding] = useState(false);

  if (depts.isPending) return <TableSkeleton rows={8} cols={6} />;
  if (depts.isError) return <ErrorState error={depts.error} />;
  const people_ = (people.data?.items ?? []).map((p) => ({ value: p.id, label: p.name, hint: `${p.department.name} · ${p.email}` }));

  const personSelect = (d: AdminDepartment, field: "headId" | "lineManagerId", current: AdminDepartment["head"]) => (
    <Combobox
      aria-label={`${field === "headId" ? "Head" : "Line manager"} of ${d.name}`}
      value={current?.id}
      noneLabel="None"
      placeholder="Search people"
      // Someone no longer active stays visible as the current choice.
      options={current && !people_.some((o) => o.value === current.id) ? [{ value: current.id, label: current.name }, ...people_] : people_}
      onChange={(v) => update.mutate({ id: d.id, [field]: v ?? null })}
    />
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Departments" right={<Button variant="secondary" onClick={() => setAdding((a) => !a)}>{adding ? "Close" : "Add department"}</Button>} />
        {adding && <AddDepartment onDone={() => setAdding(false)} />}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase">
                <th className="px-4 py-2.5">Code</th>
                <th className="px-4 py-2.5">Department</th>
                <th className="px-4 py-2.5">Head</th>
                <th className="px-4 py-2.5">Line manager</th>
                <th className="px-4 py-2.5">Users</th>
                <th className="px-4 py-2.5">Approval route</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {depts.data.items.map((d) => (
                <tr key={d.id} className={d.active ? "" : "opacity-60"}>
                  <td className="px-4 py-2.5"><Mono>{d.code}</Mono></td>
                  <td className="px-4 py-2.5 font-bold text-ink">{d.name}</td>
                  <td className="w-48 px-4 py-2.5">{personSelect(d, "headId", d.head)}</td>
                  <td className="w-48 px-4 py-2.5">{personSelect(d, "lineManagerId", d.lineManager)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-ink-2">{d.userCount}</td>
                  <td className="px-4 py-2.5">{d.hasCustomRoute ? <Pill tone="blue">Custom</Pill> : <Pill tone="gray">Default</Pill>}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant={d.active ? "danger" : "secondary"}
                      className="px-3 py-1 text-xs"
                      onClick={async () => {
                        const ok = !d.active || (await confirm({
                          title: `Deactivate ${d.name}?`,
                          message: "It will no longer be offered for new change requests. Existing changes and users are kept, and you can reactivate it later.",
                          confirmLabel: "Deactivate",
                          tone: "danger",
                        }));
                        if (ok) update.mutate({ id: d.id, active: !d.active });
                      }}
                    >
                      {d.active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AddDepartment({ onDone }: { onDone: () => void }) {
  const create = useCreateDepartment();
  const { register, handleSubmit, formState: { errors } } = useForm<DepartmentCreateInput>({ resolver: zodResolver(departmentCreateSchema) });
  return (
    <form onSubmit={handleSubmit((v) => create.mutate(v, { onSuccess: onDone }))} noValidate className="grid gap-3 border-b border-line bg-surface-2 p-4 sm:grid-cols-[140px_1fr_auto] sm:items-end">
      <Field label="Code" htmlFor="dept-code" error={errors.code?.message}>
        <Input id="dept-code" placeholder="e.g. LEG" invalid={!!errors.code} {...register("code")} />
      </Field>
      <Field label="Name" htmlFor="dept-name" error={errors.name?.message ?? create.error?.message}>
        <Input id="dept-name" placeholder="e.g. Legal" invalid={!!errors.name} {...register("name")} />
      </Field>
      <Button type="submit" loading={create.isPending}>Add</Button>
    </form>
  );
}
