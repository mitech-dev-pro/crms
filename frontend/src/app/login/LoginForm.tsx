"use client";

import { loginSchema, type LoginInput } from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { ApiError } from "@/lib/api";
import { useLogin } from "@/lib/queries";

// Demo accounts for development are listed in docs/DEMO_ACCOUNTS.md, not on this screen.

export default function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      // Only follow same-site paths, so ?next= can't send someone to another website.
      onSuccess: (user) =>
        router.replace(
          user.mustChangePassword
            ? "/change-password"
            : next?.startsWith("/") && !next.startsWith("//")
              ? next
              : "/dashboard",
        ),
    }),
  );

  const serverError =
    login.error instanceof ApiError
      ? login.error.message
      : login.error
        ? "Could not reach the server. Check your connection and try again."
        : null;
  const sessionEnded = !!next && !serverError; // sent here from a page: their session ended or they weren't signed in

  return (
    <div>
      <h1 className="rise font-display text-[2rem] leading-tight font-medium tracking-tight text-ink">
        Welcome back
      </h1>
      <p className="rise rise-1 mt-2 text-sm leading-relaxed text-muted">
        Sign in with your MiLife email address to raise, approve and track
        changes.
      </p>

      {sessionEnded && (
        <p className="rise rise-1 mt-5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink-2">
          Please sign in to continue to that page.
        </p>
      )}

      <form
        onSubmit={onSubmit}
        noValidate
        className="rise rise-2 mt-7 space-y-5"
      >
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="firstname.lastname@milifeghana.com"
            autoFocus
            invalid={!!errors.email}
            {...register("email")}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            invalid={!!errors.password}
            {...register("password")}
          />
        </Field>
        {serverError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-[var(--red-bg)] px-3 py-2.5 text-sm font-semibold text-[var(--red-fg)]"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            {serverError}
          </p>
        )}
        <Button
          type="submit"
          loading={login.isPending}
          className="group w-full py-2.5"
        >
          Sign in
          {!login.isPending && (
            <ArrowRight
              size={16}
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          )}
        </Button>
      </form>

      <div className="rise rise-3 mt-6 space-y-4 text-sm">
        <p className="text-muted">
          <span className="font-semibold text-ink-2">
            Forgot your password?
          </span>{" "}
          Ask your System Administrator. They can issue a one-time temporary
          password.
        </p>
        <p className="flex items-center gap-2 border-t border-line pt-4 text-xs text-muted">
          <ShieldCheck size={15} className="shrink-0 text-teal" aria-hidden />
          Restricted system. Every sign-in is recorded in the audit trail.
        </p>
      </div>
    </div>
  );
}
