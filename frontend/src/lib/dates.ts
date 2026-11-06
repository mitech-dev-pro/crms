// Calendar-date helpers. Dates travel as "YYYY-MM-DD" strings everywhere (API, forms),
// and are only turned into Date objects in local time for display and arithmetic.

/** Local-time "YYYY-MM-DD" (toISOString would shift the date across time zones). */
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** "YYYY-MM-DD" → local Date at midnight, or null if it isn't a real date. */
export function parseYmd(value: string | null | undefined): Date | null {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.getMonth() === Number(m[2]) - 1 ? d : null; // rejects 2026-02-31
}

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Same day-of-month n months away, clamped (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(d: Date, n: number) {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
}

/** Monday-based weekday index: Mon 0 … Sun 6. */
export const weekdayMon = (d: Date) => (d.getDay() + 6) % 7;

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "dec", "Dec.", "december", "sept" → 11 / 11 / 11 / 8; anything else → -1. */
function monthFromName(name: string) {
  const n = name.replace(/\.$/, "");
  if (n === "sept") return 8;
  return n.length >= 3 ? MONTH_NAMES.findIndex((m) => m.startsWith(n)) : -1;
}

/** Two-digit years: up to 20 years ahead is this century, the rest the last ("98" → 1998, "30" → 2030). */
function fullYear(y: string, now: Date) {
  if (y.length === 4) return Number(y);
  const n = 2000 + Number(y);
  return n <= now.getFullYear() + 20 ? n : n - 100;
}

/**
 * Reads a date the way people type it, day first (as in Ghana and the UK), and returns
 * "YYYY-MM-DD", or null if it can't be read or isn't a real date. Accepts:
 *   20/12/1998  20-12-98  20.12.1998  20 12 1998  20121998  20/12 (this year)
 *   1998-12-20  20 Dec 1998  20th December 1998  Dec 20, 1998  Sun, 20 Dec 1998
 *   today  tomorrow  yesterday
 */
export function parseDateInput(text: string, now = new Date()): string | null {
  const s = text
    .trim()
    .toLowerCase()
    .replace(/,/g, " ")
    .replace(/^(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s+/, "") // a leading weekday, as we display it
    .replace(/\s+/g, " ");
  if (!s) return null;
  if (s === "today") return ymd(now);
  if (s === "tomorrow") return ymd(addDays(now, 1));
  if (s === "yesterday") return ymd(addDays(now, -1));

  let d: number, m: number, y: number, r: RegExpMatchArray | null;
  if ((r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/))) {
    [y, m, d] = [Number(r[1]), Number(r[2]) - 1, Number(r[3])]; // ISO, year first
  } else if ((r = s.match(/^(\d{1,2})[-/. ](\d{1,2})(?:[-/. ](\d{4}|\d{2}))?$/))) {
    [d, m, y] = [Number(r[1]), Number(r[2]) - 1, r[3] ? fullYear(r[3], now) : now.getFullYear()];
  } else if ((r = s.match(/^(\d{2})(\d{2})(\d{4})$/))) {
    [d, m, y] = [Number(r[1]), Number(r[2]) - 1, Number(r[3])]; // 20121998
  } else if ((r = s.match(/^(\d{1,2})(?:st|nd|rd|th)? ?([a-z]+\.?)(?: (\d{4}|\d{2}))?$/))) {
    [d, m, y] = [Number(r[1]), monthFromName(r[2]!), r[3] ? fullYear(r[3], now) : now.getFullYear()];
  } else if ((r = s.match(/^([a-z]+\.?) (\d{1,2})(?:st|nd|rd|th)?(?: (\d{4}|\d{2}))?$/))) {
    [m, d, y] = [monthFromName(r[1]!), Number(r[2]), r[3] ? fullYear(r[3], now) : now.getFullYear()];
  } else {
    return null;
  }
  if (m < 0 || m > 11 || d < 1) return null;
  const iso = `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return parseYmd(iso) ? iso : null; // rejects 31/02
}

/** The 5–6 week grid for a month, starting on Monday like the prototype. */
export function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const start = addDays(first, -weekdayMon(first));
  const weeks = Math.ceil((weekdayMon(first) + new Date(year, month + 1, 0).getDate()) / 7);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}
