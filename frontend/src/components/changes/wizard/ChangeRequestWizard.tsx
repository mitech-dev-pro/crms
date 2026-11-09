"use client";

import {
  changeCreateSchema, wizardStepSchemas, type ChangeCreateFormInput, type ChangeCreateInput, type ChangeDetail,
  type MetaResponse, type SessionUser,
} from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, Forbidden, FormSkeleton } from "@/components/ui/States";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, apiUpload } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useUnsavedGuard } from "@/lib/use-unsaved-guard";
import { keys, useChange, useCreateChange, useMe, useMeta, useSubmitChange, useUpdateChange } from "@/lib/queries";
import { ClassifyStep, DescribeStep, PlanStep, ReviewStep, RiskStep } from "./Steps";

const STEPS = ["Classify", "Describe", "Risk & impact", "Plan", "Review"] as const;

// The form holds the schema's input; `attest` is a checkbox, so false until ticked
// (the schema only accepts true, which is what makes ticking it compulsory).
export type WizardValues = Omit<ChangeCreateFormInput, "attest"> & { attest: boolean };

// Field names per step, taken from the shared per-step schemas, so "Continue"
// validates exactly the fields on screen.
const STEP_FIELDS = wizardStepSchemas.map((s) => Object.keys(s.shape)) as (keyof WizardValues)[][];

/** Loads what the form needs (and the existing change when editing), then renders the form. */
export default function ChangeRequestWizard({ editRef, copyFrom }: { editRef?: string; copyFrom?: string }) {
  const { data: me } = useMe();
  const meta = useMeta();
  const sourceRef = editRef ?? copyFrom;
  const existing = useChange(sourceRef ?? "", !!sourceRef);

  if (!me || meta.isPending || (sourceRef && existing.isPending)) return <FormSkeleton />;
  if (meta.isError) return <ErrorState error={meta.error} />;
  if (sourceRef && existing.isError) return <ErrorState error={existing.error} />;
  if (editRef && existing.data && !existing.data.actions.edit) {
    return <Forbidden message="This request can no longer be edited. Only the requester can edit, and only while it's a draft or returned for rework." />;
  }
  return (
    <WizardForm
      key={editRef ?? (copyFrom ? `copy-${copyFrom}` : "new")}
      me={me}
      meta={meta.data}
      existing={editRef ? existing.data : undefined}
      template={copyFrom ? existing.data : undefined}
    />
  );
}

/** Defaults for a copy: everything except the date, the attachments and the declaration. */
function copyDefaults(me: SessionUser, meta: MetaResponse, t: ChangeDetail): WizardValues {
  const base = defaultsFor(me, meta, t);
  const active = (id: string, list: { id: string }[]) => (list.some((x) => x.id === id) ? id : undefined);
  return {
    ...base,
    title: t.title.startsWith("Copy of ") ? t.title : `Copy of ${t.title}`.slice(0, 160),
    plannedDate: undefined,
    departmentId: active(base.departmentId, meta.departments) ?? me.department.id,
    typeId: active(base.typeId, meta.changeTypes) ?? meta.changeTypes[0]?.id ?? "",
    implementerId: base.implementerId && active(base.implementerId, meta.implementers),
  };
}

function defaultsFor(me: SessionUser, meta: MetaResponse, c?: ChangeDetail): WizardValues {
  if (c) {
    return {
      typeId: c.type.id, departmentId: c.department.id, emergency: c.emergency,
      title: c.title === "Untitled change" ? "" : c.title, summary: c.summary, reason: c.reason, systems: c.systems,
      impact: c.impact as 1 | 2 | 3, likelihood: c.likelihood as 1 | 2 | 3,
      customerFacing: c.customerFacing, regulatory: c.regulatory, personalData: c.personalData,
      plannedDate: c.plannedDate ?? undefined, window: c.window ?? "", implementerId: c.implementer?.id,
      testPlan: c.testPlan ?? "", rollbackPlan: c.rollbackPlan ?? "", attest: false,
    };
  }
  return {
    typeId: meta.changeTypes.find((t) => t.label === "IT / system")?.id ?? meta.changeTypes[0]?.id ?? "",
    departmentId: me.department.id, emergency: false,
    title: "", summary: "", reason: "", systems: [],
    impact: 2, likelihood: 1, customerFacing: false, regulatory: false, personalData: false,
    plannedDate: undefined, window: "20:00–23:00", implementerId: undefined, testPlan: "", rollbackPlan: "", attest: false,
  };
}

/** A draft may be half-filled: drop empty values so the server's draft schema accepts it. */
function draftPayload(v: WizardValues) {
  return Object.fromEntries(Object.entries(v).filter(([k, val]) => k !== "attest" && val !== "" && val !== undefined)) as Partial<ChangeCreateInput> &
    Pick<ChangeCreateInput, "typeId" | "departmentId">;
}

function WizardForm({ me, meta, existing, template }: { me: SessionUser; meta: MetaResponse; existing?: ChangeDetail; template?: ChangeDetail }) {
  const router = useRouter();
  const editRef = existing?.ref;
  const [step, setStep] = useState(0);
  const form = useForm<WizardValues, unknown, ChangeCreateInput>({
    // The resolver validates against the same schema the API uses.
    resolver: zodResolver(changeCreateSchema) as unknown as Resolver<WizardValues, unknown, ChangeCreateInput>,
    defaultValues: template ? copyDefaults(me, meta, template) : defaultsFor(me, meta, existing),
    mode: "onTouched",
  });

  const create = useCreateChange();
  const update = useUpdateChange(editRef ?? "");
  const submitExisting = useSubmitChange(editRef ?? "", { inlineError: true });
  const [uploading, setUploading] = useState(false);
  const busy = create.isPending || update.isPending || submitExisting.isPending || uploading;
  const [serverError, setServerError] = useState<string | null>(null);
  const qc = useQueryClient();
  // Files picked on the Describe step. They're uploaded once the change exists.
  const [files, setFiles] = useState<File[]>([]);
  // Typed something or picked files, and not saved yet: warn before leaving.
  const allowLeave = useUnsavedGuard(form.formState.isDirty || files.length > 0, "This request isn't saved yet.");

  /** Uploads the picked files to a saved change, then opens it. A failed upload still opens it, with a notice. */
  const uploadThenOpen = async (ref: string) => {
    allowLeave(); // saved: leaving for the change page is expected
    let failed = false;
    if (files.length) {
      setUploading(true);
      try {
        await apiUpload(`/changes/${ref}/attachments`, files);
      } catch {
        failed = true;
      } finally {
        setUploading(false);
        await qc.invalidateQueries({ queryKey: keys.change(ref) }); // show the new files on the detail page
      }
    }
    if (failed) toast.error("The change was saved, but the files did not upload. Add them again from Attachments on the change page.");
    router.push(`/changes/${ref}`);
  };

  const goTo = (i: number) => {
    setStep(i);
    window.scrollTo({ top: 0 });
  };

  /** Show server field errors on the fields themselves, and jump to the first step that has one. */
  const handleServerError = (err: unknown) => {
    if (err instanceof ApiError && Object.keys(err.fields).length) {
      for (const [field, message] of Object.entries(err.fields)) form.setError(field as keyof WizardValues, { message });
      const first = STEP_FIELDS.findIndex((fields) => fields.some((f) => f in err.fields));
      if (first >= 0) goTo(first);
      setServerError("Please fix the highlighted fields.");
    } else {
      setServerError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const next = async () => {
    if (await form.trigger(STEP_FIELDS[step])) goTo(step + 1);
  };

  const onSubmit = form.handleSubmit(
    async (values) => {
      setServerError(null);
      try {
        if (editRef) {
          await update.mutateAsync(draftPayload(values as WizardValues));
          await submitExisting.mutateAsync();
          toast.success(`${editRef} resubmitted for approval`);
          await uploadThenOpen(editRef);
        } else {
          const created = await create.mutateAsync({ ...values, submit: true });
          toast.success(`${created.ref} submitted for approval`);
          await uploadThenOpen(created.ref);
        }
      } catch (e) {
        handleServerError(e);
      }
    },
    // Client validation failed somewhere: go to the first step with an error.
    (errors) => {
      const first = STEP_FIELDS.findIndex((fields) => fields.some((f) => f in errors));
      if (first >= 0) goTo(first);
    },
  );

  const saveDraft = async () => {
    setServerError(null);
    try {
      const payload = draftPayload(form.getValues());
      const saved = editRef ? await update.mutateAsync(payload) : await create.mutateAsync(payload);
      toast.success(`Draft ${saved.ref} saved`);
      await uploadThenOpen(saved.ref);
    } catch (e) {
      handleServerError(e);
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {editRef && <p className="text-sm text-muted">Editing <span className="font-mono">{editRef}</span></p>}
        {template && (
          <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink-2">
            Copied from <span className="font-mono">{template.ref}</span>. Set a new planned date and check every step before you submit.
            Attachments aren&apos;t copied.
          </p>
        )}

        <ol className="flex flex-wrap gap-2" aria-label="Steps">
          {STEPS.map((label, i) => {
            const state = i < step ? "done" : i === step ? "current" : "todo";
            return (
              <li key={label}>
                <button
                  type="button"
                  onClick={() => i < step && goTo(i)}
                  disabled={i > step}
                  aria-current={state === "current" ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-bold ${
                    state === "current" ? "border-navy bg-navy text-white" : state === "done" ? "border-transparent bg-teal-tint text-teal-strong" : "border-line bg-surface text-muted"
                  }`}
                >
                  <span className={`flex size-5 items-center justify-center rounded-full border text-[11px] ${state === "current" ? "border-white/60" : "border-current"}`}>
                    {state === "done" ? <Check size={12} strokeWidth={3} /> : i + 1}
                  </span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>

        <Card className="p-5 sm:p-6">
          {step === 0 && <ClassifyStep meta={meta} />}
          {step === 1 && <DescribeStep files={files} onFiles={setFiles} existingCount={existing?.attachments.length ?? 0} />}
          {step === 2 && <RiskStep />}
          {step === 3 && <PlanStep meta={meta} />}
          {step === 4 && <ReviewStep meta={meta} />}

          {serverError && <p role="alert" className="mt-4 rounded-lg bg-[var(--red-bg)] px-3 py-2 text-sm font-semibold text-[var(--red-fg)]">{serverError}</p>}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <Button type="button" variant="secondary" onClick={saveDraft} disabled={busy}>Save draft</Button>
            <div className="flex gap-2">
              {step > 0 && <Button type="button" variant="secondary" onClick={() => goTo(step - 1)} disabled={busy}>Back</Button>}
              {/* Different keys so React creates a new button: otherwise "Continue" turns into
                  the submit button in place, and a double-click on the last Continue would submit. */}
              {step < STEPS.length - 1 ? (
                <Button key="continue" type="button" onClick={next}>Continue</Button>
              ) : (
                <Button key="submit" type="submit" loading={busy}>{existing?.status === "ReturnedForRework" ? "Resubmit for approval" : "Submit for approval"}</Button>
              )}
            </div>
          </div>
        </Card>
      </form>
    </FormProvider>
  );
}
