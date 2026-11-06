import { z } from "zod";
import { ROLES } from "../enums";

export const AUDIT_CATEGORIES = ["signin", "change", "decision", "config", "export"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

/** Query string for GET /api/audit. Values arrive as strings, so numbers are coerced. */
export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().optional(),
  role: z.enum(ROLES).optional(),
  category: z.enum(AUDIT_CATEGORIES).optional(),
  /** Inclusive calendar days, "YYYY-MM-DD". */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type AuditQuery = z.infer<typeof auditQuerySchema>;
