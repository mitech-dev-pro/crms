import { z } from "zod";
import type { Role } from "../enums";

/** Roles that may add or remove freeze windows (from the change calendar). */
export const FREEZE_MANAGERS: readonly Role[] = ["changeManager", "superAdmin"];

/** GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD — the visible grid, at most ~6 weeks. */
export const calendarQuerySchema = z
  .object({ from: z.iso.date(), to: z.iso.date() })
  .refine((q) => q.from <= q.to, { message: "from must be on or before to", path: ["to"] })
  .refine((q) => (Date.parse(q.to) - Date.parse(q.from)) / 86_400_000 <= 62, { message: "Range is limited to 62 days", path: ["to"] });

/** POST /api/freezes */
export const freezeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    from: z.iso.date({ error: "Start date is required" }),
    to: z.iso.date({ error: "End date is required" }),
  })
  .refine((f) => f.from <= f.to, { message: "End date must be on or after the start date", path: ["to"] });
export type FreezeInput = z.infer<typeof freezeSchema>;

export const REPORT_PERIODS = ["quarter", "year", "all"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

/** GET /api/reports?period=quarter|year|all */
export const reportsQuerySchema = z.object({ period: z.enum(REPORT_PERIODS).default("year") });
