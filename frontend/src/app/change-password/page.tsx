"use client";

import { changePasswordFormSchema, type ChangePasswordFormInput, type SessionUser } from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import AuthShell from "@/components/auth/AuthShell";
import PasswordChecklist from "@/components/auth/PasswordChecklist";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field } from "@/components/ui/Form";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Spinner } from "@/components/ui/States";
import { api, ApiError } from "@/lib/api";
import { keys, useLogout, useMe } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";

/** Change your password. Also where users land after an admin issues a temporary password. */
export default function ChangePasswordPage() {
  const hydrated = useHydrated();
  const { data: me } = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const logout = useLogout();
  const [done, setDone] = useState(false);
  const { register, handleSubmit, setError, control, formState: { errors, isSubmitting } } = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(changePasswordFormSchema),
  });
  const [pw = "", confirm = ""] = useWatch({ control, name: ["newPassword", "confirm"] });

  if (!hydrated || !me) return <Spinner />;
  const forced = me.mustChangePassword;

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      const user = await api<SessionUser>("/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
      qc.setQueryData(keys.me, user);
      setDone(true);
      if (forced) router.replace("/dashboard");
    } catch (e) {
      if (e instanceof ApiError && e.fields.newPassword) setError("newPassword", { message: e.fields.newPassword });
      else setError("currentPassword", { message: e instanceof Error ? e.message : "Something went wrong" });
    }
  });

  return (
    <AuthShell panel="password">
      <title>Change password · MiLife ChangeHub</title>
      <h1 className="rise font-display text-[2rem] leading-tight font-medium tracking-tight text-ink">
        {forced ? "Choose your password" : "Change password"}
      </h1>
      <p className="rise rise-1 mt-2 text-sm leading-relaxed text-muted">
        {forced ? (
          <>Hi {me.name.split(" ")[0]}, you signed in with a temporary password. Choose your own to continue.</>
        ) : (
          <>Signed in as <span className="font-semibold text-ink-2">{me.email}</span>.</>
        )}
      </p>

      {done && !forced ? (
        <div className="rise mt-7 space-y-5">
          <p role="status" className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold" style={{ background: "var(--green-bg)", color: "var(--green-fg)" }}>
            <CheckCircle2 size={16} aria-hidden /> Your password has been changed.
          </p>
          <ButtonLink href="/dashboard" className="w-full py-2.5">Back to the dashboard</ButtonLink>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="rise rise-2 mt-7 space-y-5">
          <input type="email" autoComplete="username" value={me.email} readOnly hidden />
          <Field label={forced ? "Temporary password" : "Current password"} htmlFor="current" error={errors.currentPassword?.message}>
            <PasswordInput id="current" autoComplete="current-password" autoFocus invalid={!!errors.currentPassword} {...register("currentPassword")} />
          </Field>
          <Field label="New password" htmlFor="new" error={errors.newPassword?.message}>
            <PasswordInput id="new" autoComplete="new-password" invalid={!!errors.newPassword} {...register("newPassword")} />
          </Field>
          <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
            <PasswordInput id="confirm" autoComplete="new-password" invalid={!!errors.confirm} {...register("confirm")} />
          </Field>

          <PasswordChecklist password={pw} confirm={confirm} />

          <Button type="submit" loading={isSubmitting} className="w-full py-2.5">Save new password</Button>
          {forced ? (
            <Button type="button" variant="ghost" className="w-full" onClick={() => logout.mutate()}>Sign out</Button>
          ) : (
            <ButtonLink href="/dashboard" variant="ghost" className="w-full">Cancel</ButtonLink>
          )}
          {!forced && <p className="text-center text-xs text-muted">Changing your password signs you out on every other device.</p>}
        </form>
      )}
    </AuthShell>
  );
}
