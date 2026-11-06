"use client";

import { loginSchema, type LoginInput } from "@crms/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import Logo from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Form";
import { ApiError } from "@/lib/api";
import { useLogin } from "@/lib/queries";

// Dev-only shortcuts: one seeded user per role (password: demo-password).
const DEMO_ACCOUNTS = [
  ["Requester", "ama.mensah"],
  ["Line Manager", "kwame.boateng"],
  ["Department Head", "efua.asante"],
  ["Change Manager", "yaw.owusu"],
  ["Deputy Change Manager", "deputy.change.manager"],
  ["CAB Member", "akosua.darko"],
  ["Risk & Compliance", "nana.agyeman"],
  ["Implementer", "kojo.frimpong"],
  ["Executive", "abena.osei"],
  ["System Admin", "selorm.dzidzienyo"],
  ["Super Admin", "super.admin"],
] as const;

export default function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const login = useLogin();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit((values) =>
    login.mutate(values, {
      // Only follow same-site paths, so ?next= can't send someone to another website.
      onSuccess: (user) =>
        router.replace(user.mustChangePassword ? "/change-password" : next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"),
    }),
  );

  const serverError = login.error instanceof ApiError ? login.error.message : login.error ? "Could not reach the server" : null;

  return (
    <div className="w-full max-w-sm">
      <Card className="p-6 sm:p-8">
        <Logo className="mb-1 h-14" />
        <p className="mb-6 text-xs font-extrabold tracking-[0.12em] text-teal uppercase">Change management</p>
        <h1 className="text-xl font-extrabold text-ink">Sign in</h1>
        <p className="mt-1 mb-6 text-sm text-muted">Use your MiLife email address.</p>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <Input id="email" type="email" autoComplete="username" invalid={!!errors.email} {...register("email")} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <Input id="password" type="password" autoComplete="current-password" invalid={!!errors.password} {...register("password")} />
          </Field>
          {serverError && (
            <p role="alert" className="rounded-lg bg-[var(--red-bg)] px-3 py-2 text-sm font-semibold text-[var(--red-fg)]">
              {serverError}
            </p>
          )}
          <Button type="submit" loading={login.isPending} className="w-full">
            Sign in
          </Button>
        </form>
      </Card>

      {process.env.NODE_ENV !== "production" && (
        <Card className="mt-4 p-4">
          <p className="mb-2 text-xs font-bold text-muted">Demo accounts (dev only) · password demo-password</p>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_ACCOUNTS.map(([role, handle]) => (
              <button
                key={handle}
                type="button"
                onClick={() => {
                  setValue("email", `${handle}@milife.com.gh`);
                  setValue("password", "demo-password");
                }}
                className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-ink-2 hover:border-teal-bright hover:bg-teal-tint"
              >
                {role}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
