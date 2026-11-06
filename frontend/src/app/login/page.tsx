import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · MiLife ChangeHub" };

export default function LoginPage() {
  return (
    <AuthShell panel="signin">
      {/* LoginForm reads ?next= from the URL, which needs a Suspense boundary under Cache Components. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
