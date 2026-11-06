"use client";

import { changeTypeCreateSchema, type AdminChangeType, type ChangeTypeCreateInput } from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Form";
import { ErrorState, TableSkeleton } from "@/components/ui/States";
import { useAdminChangeTypes, useCreateChangeType, useUpdateChangeType } from "@/lib/admin-queries";

export default function ChangeTypesTab() {
  const types = useAdminChangeTypes();
  const update = useUpdateChangeType();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  if (types.isPending) return <TableSkeleton rows={6} cols={3} />;
  if (types.isError) return <ErrorState error={types.error} />;

  return (
    <Card>
      <CardHeader title="Change types" right={<Button variant="secondary" onClick={() => setAdding((a) => !a)}>{adding ? "Close" : "Add change type"}</Button>} />
      {adding && <div className="border-b border-line bg-surface-2 p-4"><TypeForm onDone={() => setAdding(false)} /></div>}
      {update.error && <p className="px-4 pt-3 text-xs font-semibold text-danger">{update.error.message}</p>}
      <ul className="divide-y divide-line">
        {types.data.items.map((t) => (
          <li key={t.id} className={`px-4 py-3 ${t.active ? "" : "opacity-60"}`}>
            {editing === t.id ? (
              <TypeForm type={t} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-ink">{t.label}</p>
                  <p className="text-sm text-muted">{t.description}</p>
                  <p className="text-xs text-faint">{t.changeCount} change requests{t.active ? "" : " · inactive: not offered for new requests"}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="px-3 py-1 text-xs" onClick={() => setEditing(t.id)}>Edit</Button>
                  <Button variant={t.active ? "danger" : "secondary"} className="px-3 py-1 text-xs" onClick={() => update.mutate({ id: t.id, active: !t.active })}>
                    {t.active ? "Deactivate" : "Reactivate"}
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Add a type, or edit one when `type` is given. */
function TypeForm({ type, onDone }: { type?: AdminChangeType; onDone: () => void }) {
  const create = useCreateChangeType();
  const update = useUpdateChangeType();
  const m = type ? update : create;
  const { register, handleSubmit, formState: { errors } } = useForm<ChangeTypeCreateInput>({
    resolver: zodResolver(changeTypeCreateSchema),
    defaultValues: type ? { label: type.label, description: type.description } : undefined,
  });
  const save = handleSubmit((v) => (type ? update.mutate({ id: type.id, ...v }, { onSuccess: onDone }) : create.mutate(v, { onSuccess: onDone })));
  const idp = type?.id ?? "new";
  return (
    <form onSubmit={save} noValidate className="grid gap-3 sm:grid-cols-[220px_1fr_auto] sm:items-end">
      <Field label="Label" htmlFor={`ct-label-${idp}`} error={errors.label?.message}>
        <Input id={`ct-label-${idp}`} invalid={!!errors.label} {...register("label")} />
      </Field>
      <Field label="Description" htmlFor={`ct-desc-${idp}`} error={errors.description?.message ?? m.error?.message}>
        <Input id={`ct-desc-${idp}`} invalid={!!errors.description} {...register("description")} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" loading={m.isPending}>{type ? "Save" : "Add"}</Button>
        {type && <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>}
      </div>
    </form>
  );
}
