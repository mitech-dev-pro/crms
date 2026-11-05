"use client";

import { IMPACT_LABELS, LIKELIHOOD_LABELS, calcRisk, type MetaResponse } from "@crms/shared";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Pill } from "@/components/ui/Badges";
import { Checkbox, Field, Input, OptionCard, Select, Textarea } from "@/components/ui/Form";
import { formatDate } from "@/lib/format";
import { useRoutePreview } from "@/lib/queries";
import type { WizardValues } from "./ChangeRequestWizard";

const optionalString = { setValueAs: (v: string) => v || undefined }; // "" → undefined, so optional fields stay optional

function StepTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-extrabold text-ink">{title}</h2>
      {children && <p className="mt-1 text-sm text-muted">{children}</p>}
    </div>
  );
}

// ------------------------------------------------------------------ 1. Classify

export function ClassifyStep({ meta }: { meta: MetaResponse }) {
  const { register, setValue, control, formState: { errors } } = useFormContext<WizardValues>();
  const typeId = useWatch({ control, name: "typeId" });
  return (
    <>
      <StepTitle title="Classify the change">Choose what kind of change this is and which department owns it.</StepTitle>
      <p className="mb-2 text-sm font-bold text-ink">Change type</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {meta.changeTypes.map((t) => (
          <OptionCard key={t.id} selected={typeId === t.id} title={t.label} description={t.description} onClick={() => setValue("typeId", t.id, { shouldValidate: true })} />
        ))}
      </div>
      {errors.typeId && <p className="mt-1 text-xs font-semibold text-danger">{errors.typeId.message}</p>}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Department" htmlFor="departmentId" error={errors.departmentId?.message}>
          <Select id="departmentId" invalid={!!errors.departmentId} {...register("departmentId")}>
            {meta.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-5 rounded-lg border border-line p-3">
        <Checkbox label={<b className="text-ink">This is an emergency change</b>} {...register("emergency")} />
        <p className="mt-1 pl-6 text-xs text-muted">Service down or a security issue. Goes to the Change Manager and Emergency CAB, and needs a post-implementation review within 5 days.</p>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ 2. Describe

export function DescribeStep() {
  const { register, control, formState: { errors } } = useFormContext<WizardValues>();
  return (
    <>
      <StepTitle title="Describe the change">What is changing, and why.</StepTitle>
      <div className="space-y-4">
        <Field label="Title" htmlFor="title" error={errors.title?.message}>
          <Input id="title" invalid={!!errors.title} placeholder="e.g. Add mobile money payout option to claims portal" {...register("title")} />
        </Field>
        <Field label="Summary" htmlFor="summary" error={errors.summary?.message}>
          <Textarea id="summary" invalid={!!errors.summary} placeholder="What will change?" {...register("summary")} />
        </Field>
        <Field label="Business justification" htmlFor="reason" error={errors.reason?.message}>
          <Textarea id="reason" placeholder="Why is it needed?" {...register("reason")} />
        </Field>
        <Field label="Systems & areas affected" htmlFor="systems" hint="Separate with commas, e.g. Claims portal, Payments gateway">
          {/* The form stores a list; the input shows it as comma-separated text. */}
          <Controller
            control={control}
            name="systems"
            render={({ field }) => (
              <Input
                id="systems"
                defaultValue={(field.value ?? []).join(", ")}
                onBlur={field.onBlur}
                onChange={(e) => field.onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
              />
            )}
          />
        </Field>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ 3. Risk & impact

const IMPACT_HELP = { 1: "Single team, no customer impact", 2: "Several teams or limited customer impact", 3: "Company-wide, customer-facing or regulatory" };
const LIKELIHOOD_HELP = { 1: "Routine and well tested", 2: "Some unknowns or dependencies", 3: "New, complex or untested" };

export function RiskStep() {
  const { register, setValue, control } = useFormContext<WizardValues>();
  const [impact, likelihood] = useWatch({ control, name: ["impact", "likelihood"] });
  return (
    <>
      <StepTitle title="Risk & impact assessment">Impact × likelihood gives the risk score, which decides who must approve.</StepTitle>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 text-sm font-bold text-ink">Impact if it goes wrong</p>
          <div className="space-y-2">
            {([1, 2, 3] as const).map((n) => (
              <OptionCard key={n} selected={impact === n} title={IMPACT_LABELS[n]} description={IMPACT_HELP[n]} onClick={() => setValue("impact", n)} />
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-sm font-bold text-ink">Likelihood of issues</p>
          <div className="space-y-2">
            {([1, 2, 3] as const).map((n) => (
              <OptionCard key={n} selected={likelihood === n} title={LIKELIHOOD_LABELS[n]} description={LIKELIHOOD_HELP[n]} onClick={() => setValue("likelihood", n)} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox label="Customer-facing" {...register("customerFacing")} />
        <Checkbox label="Regulatory / NIC reporting implications" {...register("regulatory")} />
        <Checkbox label="Touches personal data (Data Protection Act)" {...register("personalData")} />
      </div>
      <RouteSummary />
    </>
  );
}

/** Live risk and approval route, from the same server logic used on submit. */
function RouteSummary({ detailed = false }: { detailed?: boolean }) {
  const { control } = useFormContext<WizardValues>();
  const [departmentId, impact, likelihood, emergency, plannedDate] = useWatch({ control, name: ["departmentId", "impact", "likelihood", "emergency", "plannedDate"] });
  const { score, risk } = calcRisk(impact as 1 | 2 | 3, likelihood as 1 | 2 | 3); // instant, no server round-trip
  const preview = useRoutePreview(departmentId ? { departmentId, impact, likelihood, emergency: !!emergency, plannedDate: plannedDate || undefined } : null);
  const p = preview.data;

  return (
    <div className="mt-5 rounded-lg bg-surface-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-ink-2">
          Calculated risk: <b style={{ color: `var(--${risk === "Low" ? "green" : risk === "Medium" ? "amber" : "red"}-fg)` }}>{emergency ? "Emergency" : risk}</b> (score {score}/9)
        </span>
        <span className="text-muted">
          Approval route: <b className="text-ink">{p?.tier ?? "…"}</b> · {p ? `${p.route.length} stages` : "…"}
        </span>
      </div>
      {detailed && p && (
        <ol className="mt-3 flex flex-wrap gap-2">
          {p.route.map((r, i) => <li key={i}><Pill tone={r.role === "exec" && p.freeze ? "amber" : "blue"}>{i + 1}. {r.label}</Pill></li>)}
        </ol>
      )}
      {p?.freeze && !emergency && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--amber-fg)" }}>
          <AlertTriangle size={14} /> {formatDate(plannedDate)} falls in the {p.freeze.name} freeze, so an Executive override stage is added.
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ 4. Plan

export function PlanStep({ meta }: { meta: MetaResponse }) {
  const { register, formState: { errors } } = useFormContext<WizardValues>();
  return (
    <>
      <StepTitle title="Plan the change">When it happens, who does it, how it&apos;s tested and how to undo it.</StepTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Planned date" htmlFor="plannedDate" error={errors.plannedDate?.message}>
          <Input id="plannedDate" type="date" invalid={!!errors.plannedDate} {...register("plannedDate", optionalString)} />
        </Field>
        <Field label="Change window" htmlFor="window" hint="e.g. 20:00–23:00 or Sat 20:00 – Sun 06:00">
          <Input id="window" {...register("window")} />
        </Field>
        <Field label="Implementer" htmlFor="implementerId" error={errors.implementerId?.message}>
          <Select id="implementerId" {...register("implementerId", optionalString)}>
            <option value="">Not assigned yet</option>
            {meta.implementers.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-4 space-y-4">
        <Field label="Test plan" htmlFor="testPlan">
          <Textarea id="testPlan" placeholder="How will you prove it works?" {...register("testPlan")} />
        </Field>
        <Field label="Rollback plan" htmlFor="rollbackPlan" error={errors.rollbackPlan?.message}>
          <Textarea id="rollbackPlan" invalid={!!errors.rollbackPlan} placeholder="How will you undo it if something goes wrong?" {...register("rollbackPlan")} />
        </Field>
      </div>
      <RouteSummary />
    </>
  );
}

// ------------------------------------------------------------------ 5. Review

export function ReviewStep({ meta }: { meta: MetaResponse }) {
  const { register, control, formState: { errors } } = useFormContext<WizardValues>();
  const v = useWatch({ control }) as WizardValues;
  const name = <T extends { id: string }>(list: T[], id?: string) => list.find((x) => x.id === id);
  const rows: [string, ReactNode][] = [
    ["Type", name(meta.changeTypes, v.typeId)?.label],
    ["Department", name(meta.departments, v.departmentId)?.name],
    ["Emergency", v.emergency ? "Yes" : "No"],
    ["Title", v.title],
    ["Summary", v.summary],
    ["Systems", v.systems?.join(", ")],
    ["Planned", v.plannedDate ? `${formatDate(v.plannedDate)} · ${v.window ?? ""}` : "Not set"],
    ["Implementer", name(meta.implementers, v.implementerId)?.name ?? "Not assigned"],
    ["Rollback plan", v.rollbackPlan],
  ];
  return (
    <>
      <StepTitle title="Review and submit">Check the details and the approval route before submitting.</StepTitle>
      <dl className="divide-y divide-line rounded-lg border border-line text-sm">
        {rows.map(([k, val]) => (
          <div key={k} className="grid gap-1 px-3 py-2 sm:grid-cols-[160px_1fr]">
            <dt className="text-muted">{k}</dt>
            <dd className="whitespace-pre-line text-ink">{val || <span className="text-faint">—</span>}</dd>
          </div>
        ))}
      </dl>
      <RouteSummary detailed />
      <div className="mt-5">
        <Checkbox label="I confirm the information is accurate and the rollback plan has been reviewed." {...register("attest")} />
        {errors.attest && <p className="mt-1 pl-6 text-xs font-semibold text-danger">{errors.attest.message}</p>}
      </div>
    </>
  );
}
