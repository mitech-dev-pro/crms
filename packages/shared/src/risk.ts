import type { RiskTier } from "./enums";

export const IMPACT_LABELS = { 1: "Minor", 2: "Moderate", 3: "Major" } as const;
export const LIKELIHOOD_LABELS = { 1: "Unlikely", 2: "Possible", 3: "Likely" } as const;

export type Level = 1 | 2 | 3;

/** impact × likelihood → score and risk band (Low ≤ 2, Medium ≤ 4, High 6–9). */
export function calcRisk(impact: Level, likelihood: Level) {
  const score = impact * likelihood;
  const risk = score <= 2 ? "Low" : score <= 4 ? "Medium" : "High";
  return { score, risk } as const;
}

/** The approval tier: Emergency overrides the calculated risk. */
export function tierFor(impact: Level, likelihood: Level, emergency: boolean): RiskTier {
  return emergency ? "Emergency" : calcRisk(impact, likelihood).risk;
}
