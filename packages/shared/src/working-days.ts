// Working days for approval deadlines: Monday to Friday. Public holidays aren't counted yet
// (a list of Ghana's holidays could be added here later). Times are kept, so a stage that
// started Monday 10:00 is due Wednesday 10:00.

/** Decisions are due this many working days after a stage starts waiting. */
export const DECISION_DUE_DAYS = 2;
/** After this many working days without a decision, the Change Manager is alerted. */
export const ESCALATE_AFTER_DAYS = 4;

const isWeekend = (d: Date) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

/** `n` working days after `from`, at the same time of day. A start on a weekend counts from Monday. */
export function addWorkingDays(from: Date, n: number): Date {
  const d = new Date(from);
  while (isWeekend(d)) d.setUTCDate(d.getUTCDate() + 1), d.setUTCHours(0, 0, 0, 0);
  for (let added = 0; added < n; ) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (!isWeekend(d)) added++;
  }
  return d;
}

/** Whole working days that have passed between `from` and `to`. */
export function workingDaysBetween(from: Date, to: Date): number {
  let n = 0;
  while (addWorkingDays(from, n + 1) <= to) n++;
  return n;
}
