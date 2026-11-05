import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · MiLife ChangeHub" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      {/* LoginForm reads ?next= from the URL, which needs a Suspense boundary under Cache Components. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
