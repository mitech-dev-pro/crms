import { Suspense } from "react";
import AuthShell from "@/components/auth/AuthShell";
import ResetForm from "./ResetForm";

export const metadata = { title: "Choose a new password · MiLife ChangeHub" };

export default function ResetPasswordPage() {
  return (
    <AuthShell panel="password">
      {/* ResetForm reads ?token= from the URL, which needs a Suspense boundary under Cache Components. */}
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
