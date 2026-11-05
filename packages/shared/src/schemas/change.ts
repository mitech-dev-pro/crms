import { z } from "zod";
import { CHANGE_STATUSES, PIR_OUTCOMES, RISK_TIERS } from "../enums";

const level = z.union([z.literal(1), z.literal(2), z.literal(3)]);

/** Everything the New Request wizard collects. The server validates the same object. */
export const changeCreateSchema = z.object({
  // Step 1 — Classify
  typeId: z.string().min(1, "Choose a change type"),
  departmentId: z.string().min(1, "Choose a department"),
  emergency: z.boolean(),

  // Step 2 — Describe
  title: z.string().trim().min(1, "Title is required").max(200),
  summary: z.string().trim().min(1, "Summary is required"),
  reason: z.string().trim(),
  systems: z.array(z.string().trim().min(1)),

  // Step 3 — Risk & impact
  impact: level,
  likelihood: level,
  customerFacing: z.boolean(),
  regulatory: z.boolean(),
  personalData: z.boolean(),

  // Step 4 — Plan
  plannedDate: z.iso.date().optional(),
  window: z.string().trim().optional(),
  implementerId: z.string().optional(),
  testPlan: z.string().trim().optional(),
  rollbackPlan: z.string().trim().min(1, "Rollback plan is required"),

  // Step 5 — Review
  attest: z.literal(true, { error: "Please confirm the declaration" }),
});
export type ChangeCreateInput = z.infer<typeof changeCreateSchema>;

/** Per-step slices so the wizard can validate one step at a time. */
export const wizardStepSchemas = [
  changeCreateSchema.pick({ typeId: true, departmentId: true, emergency: true }),
  changeCreateSchema.pick({ title: true, summary: true, reason: true, systems: true }),
  changeCreateSchema.pick({ impact: true, likelihood: true, customerFacing: true, regulatory: true, personalData: true }),
  changeCreateSchema.pick({ plannedDate: true, window: true, implementerId: true, testPlan: true, rollbackPlan: true }),
  changeCreateSchema.pick({ attest: true }),
] as const;

const changeFields = changeCreateSchema.omit({ attest: true });

/**
 * A draft may be saved half-filled. Only type and department are needed up front;
 * everything else is checked in full when the draft is submitted.
 */
export const changeDraftSchema = changeFields.partial().required({ typeId: true, departmentId: true });
export type ChangeDraftInput = z.infer<typeof changeDraftSchema>;

/** PATCH /api/changes/:ref — any subset of fields. */
export const changeUpdateSchema = changeFields.partial();
export type ChangeUpdateInput = z.infer<typeof changeUpdateSchema>;

/** POST /api/changes/:ref/submit */
export const submitSchema = z.object({
  attest: z.literal(true, { error: "Please confirm the declaration" }),
});

/** GET /api/changes query string. */
export const changeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().optional(),
  status: z.enum(CHANGE_STATUSES).optional(),
  departmentId: z.string().optional(),
  typeId: z.string().optional(),
  tier: z.enum(RISK_TIERS).optional(),
  sort: z.enum(["planned", "newest", "risk", "ref"]).default("planned"),
});
export type ChangeListQuery = z.infer<typeof changeListQuerySchema>;

/** GET /api/changes/route-preview — lets the wizard show the route before submitting. */
export const routePreviewQuerySchema = z.object({
  departmentId: z.string().min(1),
  impact: z.coerce.number().pipe(level),
  likelihood: z.coerce.number().pipe(level),
  // "false" would be truthy under z.coerce.boolean, so map the strings explicitly.
  emergency: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  plannedDate: z.iso.date().optional(),
});

/** PATCH /api/changes/:ref/tasks/:taskId */
export const taskUpdateSchema = z.object({ done: z.boolean() });

/** POST /api/changes/:ref/pir */
export const pirSchema = z.object({
  outcome: z.enum(PIR_OUTCOMES),
  notes: z.string().trim().min(1, "Review notes are required"),
});
export type PirInput = z.infer<typeof pirSchema>;

/** Approve needs no comment; reject and return always do. */
export const decisionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("approve"), comment: z.string().trim().optional() }),
  z.object({
    kind: z.enum(["reject", "return"]),
    // `error` covers a missing comment too, not just an empty one.
    comment: z.string({ error: "A comment is required" }).trim().min(1, "A comment is required"),
  }),
]);
export type DecisionInput = z.infer<typeof decisionSchema>;
