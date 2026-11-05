"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

// The theme lives on <html data-theme> (set before paint by the script in the
// root layout). useSyncExternalStore lets React read that attribute and re-render
// when it changes, without copying it into state.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const getTheme = () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
const getServerTheme = () => "light" as const; // what the server rendered

/** Switches light/dark by setting data-theme on <html>; remembered in localStorage. */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="rounded-lg border border-line-strong p-2 text-ink-2 hover:bg-surface-2"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
