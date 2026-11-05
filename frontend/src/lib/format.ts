// Display helpers. Data is fetched in the browser, so these always run with the
// user's own locale and time zone (no server/client mismatch).

/** "2026-11-05" or an ISO timestamp → "5 Nov 2026" */
export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(value + "T00:00:00") : new Date(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** ISO timestamp → "5 Nov 2026, 14:30" */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** "Yaw Owusu" → "YO" */
export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/** "Good morning" / "Good afternoon" / "Good evening" for the current hour. */
export function greeting(now = new Date()) {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
