"use client";

import { resetPasswordFormSchema, type ResetPasswordFormInput } from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import PasswordChecklist from "@/components/auth/PasswordChecklist";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field } from "@/components/ui/Form";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { api, ApiError } from "@/lib/api";

/** Choose a new password from the emailed link (?token=…). The link works once. */
export default function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [done, setDone] = useState(false);
  const [linkProblem, setLinkProblem] = useState<string | null>(token ? null : "This reset link is incomplete. Open the link from the email again, or request a new one.");
  const { register, handleSubmit, setError, control, formState: { errors, isSubmitting } } = useForm<ResetPasswordFormInput>({ resolver: zodResolver(resetPasswordFormSchema) });
  const [pw = "", confirm = ""] = useWatch({ control, name: ["newPassword", "confirm"] });

  const onSubmit = handleSubmit(async ({ newPassword }) => {
    try {
      await api("/auth/reset-password", { method: "POST", body: { token, newPassword } });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.fields.newPassword) setError("newPassword", { message: e.fields.newPassword });
      else setLinkProblem(e instanceof Error ? e.message : "Something went wrong. Try again.");
    }
  });

  if (done) {
    return (
      <div role="status">
        <span className="rise grid size-12 place-items-center rounded-full text-[var(--green-fg)]" style={{ background: "var(--green-bg)" }}>
          <CheckCircle2 size={22} aria-hidden />
        </span>
        <h1 className="rise rise-1 mt-5 font-display text-[2rem] leading-tight font-medium tracking-tight text-ink">Password changed</h1>
        <p className="rise rise-2 mt-2 text-sm leading-relaxed text-muted">You&apos;ve been signed out everywhere else. Sign in with your new password.</p>
        <ButtonLink href="/login" className="rise rise-3 mt-7 w-full py-2.5">Go to sign in</ButtonLink>
      </div>
    );
  }

  return (
    <>
      <h1 className="rise font-display text-[2rem] leading-tight font-medium tracking-tight text-ink">Choose a new password</h1>
      <p className="rise rise-1 mt-2 text-sm leading-relaxed text-muted">Pick something you don&apos;t use for any other account.</p>

      {linkProblem ? (
        <div className="rise rise-2 mt-7 space-y-5">
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-[var(--red-bg)] px-3 py-2.5 text-sm font-semibold text-[var(--red-fg)]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {linkProblem}
          </p>
          <ButtonLink href="/forgot-password" className="w-full py-2.5">Request a new link</ButtonLink>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="rise rise-2 mt-7 space-y-5">
          <Field label="New password" htmlFor="new" error={errors.newPassword?.message}>
            <PasswordInput id="new" autoComplete="new-password" autoFocus invalid={!!errors.newPassword} {...register("newPassword")} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
            <PasswordInput id="confirm" autoComplete="new-password" invalid={!!errors.confirm} {...register("confirm")} />
          </Field>
          <PasswordChecklist password={pw} confirm={confirm} />
          <Button type="submit" loading={isSubmitting} className="w-full py-2.5">Save new password</Button>
        </form>
      )}
      <Link href="/login" className="rise rise-3 mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-teal hover:underline">
        <ArrowLeft size={15} aria-hidden /> Back to sign in
      </Link>
    </>
  );
}
