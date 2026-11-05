import { Suspense } from "react";
import AppShell from "@/components/layout/AppShell";
import { SessionGate } from "@/components/layout/SessionGate";
import { Spinner } from "@/components/ui/States";

// Every signed-in page shares this layout. Pages render in the browser after
// hydration (see SessionGate), because their data depends on the session cookie.
// The shell reads the current URL (usePathname), so with Cache Components it
// sits inside a Suspense boundary.
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <SessionGate>
      <Suspense fallback={<Spinner />}>
        <AppShell>{children}</AppShell>
      </Suspense>
    </SessionGate>
  );
}
