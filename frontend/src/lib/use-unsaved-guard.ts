"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/**
 * Warns before leaving a page with unsaved work.
 * - Closing the tab, reloading or typing a new address: the browser's own "Leave site?" prompt
 *   (browsers don't allow custom text there).
 * - Clicking a link inside the app: our confirm dialog, then the navigation continues if confirmed.
 *
 * Returns `allowLeave()`: call it just before navigating away on purpose (e.g. after saving).
 */
export function useUnsavedGuard(when: boolean, message = "Your changes aren't saved yet.") {
  const router = useRouter();
  const confirm = useConfirm();
  const active = useRef(when);
  useEffect(() => {
    active.current = when;
  }, [when]);

  useEffect(() => {
    if (!when) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!active.current) return;
      e.preventDefault();
      e.returnValue = ""; // older browsers need this to show the prompt
    };
    // Capture phase: runs before Next's <Link> handles the click.
    const onClick = async (e: MouseEvent) => {
      if (!active.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      e.preventDefault();
      e.stopPropagation();
      const leave = await confirm({
        title: "Leave without saving?",
        message: `${message} Use Save draft to keep it and come back later.`,
        confirmLabel: "Leave page",
        cancelLabel: "Keep editing",
        tone: "danger",
      });
      if (leave) {
        active.current = false;
        router.push(url.pathname + url.search + url.hash);
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [when, message, confirm, router]);

  return () => {
    active.current = false;
  };
}
