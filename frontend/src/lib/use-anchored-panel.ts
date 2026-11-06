"use client";

import { useEffect, useLayoutEffect, type DependencyList, type RefObject } from "react";

const GAP = 6;

/**
 * Keeps a floating panel (rendered into <body> with `position: fixed`) attached to the field
 * that opened it: below it, or above when there's no room, and always inside the viewport.
 * Follows scrolling and resizing. Used by DatePicker and Combobox.
 *
 * width: a pixel width, or "anchor" to match the field (at least `minWidth`).
 * deps: anything that changes the panel's height, so it is re-placed.
 */
export function useAnchoredPanel(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  panel: RefObject<HTMLElement | null>,
  { width, minWidth = 220, deps = [] }: { width: number | "anchor"; minWidth?: number; deps?: DependencyList },
) {
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current?.getBoundingClientRect(), p = panel.current;
      if (!a || !p) return;
      const w = Math.min(width === "anchor" ? Math.max(a.width, minWidth) : width, window.innerWidth - 16);
      p.style.setProperty("width", `${w}px`);
      const h = p.offsetHeight;
      const below = a.bottom + GAP + h <= window.innerHeight || a.top - GAP - h < 0;
      p.style.setProperty("top", `${below ? a.bottom + GAP : a.top - GAP - h}px`);
      p.style.setProperty("left", `${Math.max(8, Math.min(a.left, window.innerWidth - w - 8))}px`);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true); // capture: any scrolling ancestor
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass what changes the panel's size
  }, [open, width, minWidth, ...deps]);
}

/** Calls onOutside for a mouse press outside every given element, while `open`. */
export function useClickOutside(open: boolean, refs: RefObject<HTMLElement | null>[], onOutside: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!refs.some((r) => r.current?.contains(e.target as Node))) onOutside();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refs are stable
  }, [open, onOutside]);
}
