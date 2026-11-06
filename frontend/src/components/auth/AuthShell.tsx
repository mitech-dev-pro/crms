/* eslint-disable @next/next/no-img-element -- small static logo */
import { Fraunces } from "next/font/google";
import type { ReactNode } from "react";
import ThemeToggle from "@/components/layout/ThemeToggle";
import Logo from "@/components/layout/Logo";
import RouteIllustration from "./RouteIllustration";

// A serif for the big headlines only: calm and trustworthy next to Manrope's UI text.
// Loaded here, so only the sign-in screens download it.
const display = Fraunces({ subsets: ["latin"], weight: ["500", "600"], style: ["normal", "italic"], variable: "--font-fraunces" });

type Panel = "signin" | "password";

const PANEL: Record<Panel, { kicker: string; title: ReactNode; body: string }> = {
  signin: {
    kicker: "MiLife ChangeHub",
    title: <>Every change, <em className="text-[#5fd6d8] not-italic sm:italic">approved</em> before it lands.</>,
    body: "Raise a request, follow it through each approval stage, and keep a full record of who decided what, and when.",
  },
  password: {
    kicker: "Account security",
    title: <>Keep your account <em className="text-[#5fd6d8] not-italic sm:italic">yours</em>.</>,
    body: "Use a password you don't use anywhere else. Changing it signs you out on every other device.",
  },
};

/**
 * Layout for the signed-out screens: a navy brand panel on the left (from large screens up)
 * and the form on the right. Phones get the form only, under a compact logo bar.
 */
export default function AuthShell({ panel, children }: { panel: Panel; children: ReactNode }) {
  const p = PANEL[panel];
  return (
    <div className={`${display.variable} grid min-h-screen bg-bg lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]`}>
      {/* ---- Brand panel */}
      <aside className="auth-panel relative hidden overflow-hidden text-white lg:flex lg:flex-col">
        <div className="kente-stripe absolute inset-x-0 top-0 h-1.5" aria-hidden />
        <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
          <div className="rise flex items-center gap-3">
            <img src="/logo-dark.png" alt="miLife Insurance" className="h-11 w-auto" />
            <span className="h-6 w-px bg-white/20" aria-hidden />
            <span className="text-xs font-extrabold tracking-[0.18em] text-[#5fd6d8] uppercase">Change management</span>
          </div>

          <div className="max-w-lg py-10">
            <p className="rise rise-1 mb-4 text-xs font-bold tracking-[0.16em] text-white/50 uppercase">{p.kicker}</p>
            <h2 className="rise rise-2 font-display text-4xl leading-[1.08] font-medium tracking-tight xl:text-[3.25rem]">{p.title}</h2>
            <p className="rise rise-3 mt-5 max-w-md text-[15px] leading-relaxed text-white/70">{p.body}</p>
            <div className="rise rise-4 mt-10">
              <RouteIllustration />
            </div>
          </div>

          <p className="rise rise-5 text-xs text-white/40">MiLife Insurance Ghana · For authorised staff only</p>
        </div>
      </aside>

      {/* ---- Form side */}
      <main className="relative flex flex-col">
        <div className="kente-stripe h-1 lg:hidden" aria-hidden />
        <div className="flex items-center justify-between p-4 sm:p-6">
          <div className="lg:invisible">
            <Logo className="h-10" />
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-12 sm:px-6">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
      </main>
    </div>
  );
}
