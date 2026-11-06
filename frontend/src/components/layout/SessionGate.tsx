"use client";

import { can, type Screen } from "@crms/shared";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { useHydrated } from "@/lib/use-hydrated";
import { ErrorState, Forbidden, Spinner } from "../ui/States";

/**
 * Everything signed-in is fetched in the browser (it depends on the session cookie),
 * so the server can only render a placeholder. The app renders once hydration is
 * done: the first browser render then matches the server HTML, and every page's
 * requests start together with /auth/me (no waterfall).
 * Pages wait for `me` where they need it; a 401 redirects to /login (see lib/api).
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const me = useMe();
  const router = useRouter();
  const mustChange = !!me.data?.mustChangePassword;
  // Still on a temporary password: nothing else is allowed until it's changed.
  useEffect(() => {
    if (mustChange) router.replace("/change-password");
  }, [mustChange, router]);
  if (!hydrated || mustChange) return <Spinner />;
  if (me.isError && !(me.error instanceof ApiError && me.error.status === 401)) {
    return <div className="p-6"><ErrorState error={me.error} /></div>;
  }
  return <>{children}</>;
}

/**
 * Shows the 403 screen if the user's role can't open this screen.
 * This is for a clear UI only. The API refuses the data anyway.
 */
export function RequirePerm({ screen, children }: { screen: Screen; children: ReactNode }) {
  const { data: me } = useMe();
  if (!me) return <Spinner />;
  return can(me.role, screen) ? <>{children}</> : <Forbidden />;
}
