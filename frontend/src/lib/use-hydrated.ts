import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * false on the server and during hydration, true afterwards.
 * Use it to render browser-only data only after hydration, so the first client
 * render always matches the server HTML (no hydration mismatch).
 */
export const useHydrated = () =>
  useSyncExternalStore(
    noop,
    () => true, // client
    () => false, // server and hydration
  );
