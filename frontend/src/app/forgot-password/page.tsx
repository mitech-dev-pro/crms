"use client";

import { forgotPasswordSchema, type ForgotPasswordInput } from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import AuthShell from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { api, ApiError } from "@/lib/api";

/** "Forgot password": asks for an email and always answers the same way, whether or not it has an account. */
export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setError(null);
    try {
      await api("/auth/forgot-password", { method: "POST", body: { email } });
      setSentTo(email);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not reach the server. Try again.");
    }
  });

  return (
    <AuthShell panel="password">
      <title>Forgot password · MiLife ChangeHub</title>
      {sentTo ? (
        <div role="status">
          <span className="rise grid size-12 place-items-center rounded-full bg-teal-tint text-teal"><MailCheck size={22} aria-hidden /></span>
          <h1 className="rise rise-1 mt-5 font-display text-[2rem] leading-tight font-medium tracking-tight text-ink">Check your email</h1>
          <p className="rise rise-2 mt-2 text-sm leading-relaxed text-muted">
            If <span className="font-semibold text-ink-2">{sentTo}</span> belongs to an active account, we&apos;ve sent a link to choose a new
            password. It works once, for 60 minutes. Check your junk folder if it hasn&apos;t arrived in a few minutes.
          </p>
          <p className="rise rise-3 mt-6 text-sm text-muted">
            No email? Your System Administrator can issue a temporary password instead.
          </p>
          <Link href="/login" className="rise rise-3 mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-teal hover:underline">
            <ArrowLeft size={15} aria-hidden /> Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h1 className="rise font-display text-[2rem] leading-tight font-medium tracking-tight text-ink">Forgot your password?</h1>
          <p className="rise rise-1 mt-2 text-sm leading-relaxed text-muted">Enter your MiLife email address and we&apos;ll send you a link to choose a new one.</p>
          <form onSubmit={onSubmit} noValidate className="rise rise-2 mt-7 space-y-5">
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" placeholder="firstname.lastname@milifeghana.com" autoFocus invalid={!!errors.email} {...register("email")} />
            </Field>
            {error && <p role="alert" className="rounded-lg bg-[var(--red-bg)] px-3 py-2.5 text-sm font-semibold text-[var(--red-fg)]">{error}</p>}
            <Button type="submit" loading={isSubmitting} className="w-full py-2.5">Email me a reset link</Button>
          </form>
          <Link href="/login" className="rise rise-3 mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-teal hover:underline">
            <ArrowLeft size={15} aria-hidden /> Back to sign in
          </Link>
        </>
      )}
    </AuthShell>
  );
}
