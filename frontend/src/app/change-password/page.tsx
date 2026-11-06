"use client";

import { changePasswordFormSchema, type ChangePasswordFormInput, type SessionUser } from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import Logo from "@/components/layout/Logo";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Form";
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
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(changePasswordFormSchema),
  });

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
    <main className="flex min-h-screen items-center justify-center p-4">
      <title>Change password · MiLife ChangeHub</title>
      <Card className="w-full max-w-sm p-6 sm:p-8">
        <Logo className="mb-6 h-12" />
        <h1 className="text-xl font-extrabold text-ink">{forced ? "Choose a new password" : "Change password"}</h1>
        <p className="mt-1 mb-6 text-sm text-muted">
          {forced
            ? "You signed in with a temporary password. Choose your own to continue."
            : "Changing your password signs you out on every other device."}
        </p>
        {done && !forced ? (
          <div className="space-y-4">
            <p role="status" className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: "var(--green-bg)", color: "var(--green-fg)" }}>
              Your password has been changed.
            </p>
            <ButtonLink href="/dashboard" className="w-full">Back to the dashboard</ButtonLink>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <input type="email" autoComplete="username" value={me.email} readOnly hidden />
            <Field label={forced ? "Temporary password" : "Current password"} htmlFor="current" error={errors.currentPassword?.message}>
              <Input id="current" type="password" autoComplete="current-password" invalid={!!errors.currentPassword} {...register("currentPassword")} />
            </Field>
            <Field label="New password" htmlFor="new" hint="At least 10 characters, with letters and a number" error={errors.newPassword?.message}>
              <Input id="new" type="password" autoComplete="new-password" invalid={!!errors.newPassword} {...register("newPassword")} />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm" error={errors.confirm?.message}>
              <Input id="confirm" type="password" autoComplete="new-password" invalid={!!errors.confirm} {...register("confirm")} />
            </Field>
            <Button type="submit" loading={isSubmitting} className="w-full">Save new password</Button>
            {forced ? (
              <Button type="button" variant="ghost" className="w-full" onClick={() => logout.mutate()}>Sign out</Button>
            ) : (
              <ButtonLink href="/dashboard" variant="ghost" className="w-full">Cancel</ButtonLink>
            )}
          </form>
        )}
      </Card>
    </main>
  );
}
