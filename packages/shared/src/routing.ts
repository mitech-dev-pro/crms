import type { RiskTier, Role } from "./enums";

export type Route = readonly Role[];
export type TierRoutes = Record<RiskTier, Route>;

/** Company-wide default approval routes. Departments may override any tier. */
export const DEFAULT_ROUTES: TierRoutes = {
  Low: ["lineManager"],
  Medium: ["lineManager", "deptHead", "changeManager"],
  High: ["lineManager", "deptHead", "risk", "cab", "changeManager"],
  Emergency: ["changeManager", "cab"],
};

export type FreezeWindow = { name: string; from: string; to: string }; // ISO dates, inclusive

export function findFreeze(date: string | undefined, freezes: readonly FreezeWindow[]) {
  if (!date) return undefined;
  // ISO "YYYY-MM-DD" strings compare correctly as plain strings.
  return freezes.find((f) => date >= f.from && date <= f.to);
}

/**
 * Builds the ordered list of approver roles for a change.
 * Order of precedence: department override → company default → freeze rule
 * (a non-emergency change dated inside a freeze gets an Executive stage).
 */
export function buildRoute(opts: {
  tier: RiskTier;
  deptOverride?: Partial<TierRoutes>;
  plannedDate?: string;
  freezes: readonly FreezeWindow[];
}): { route: Role[]; freeze?: FreezeWindow } {
  const route = [...(opts.deptOverride?.[opts.tier] ?? DEFAULT_ROUTES[opts.tier])];
  const freeze = findFreeze(opts.plannedDate, opts.freezes);
  if (freeze && opts.tier !== "Emergency" && !route.includes("exec")) route.push("exec");
  return { route, freeze };
}
