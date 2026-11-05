import { z } from "zod";

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

/** A draft may be saved half-filled, so every field is optional. */
export const changeDraftSchema = changeCreateSchema.partial();
export type ChangeDraftInput = z.infer<typeof changeDraftSchema>;

/** Approve needs no comment; reject and return always do. */
export const decisionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("approve"), comment: z.string().trim().optional() }),
  z.object({ kind: z.enum(["reject", "return"]), comment: z.string().trim().min(1, "A comment is required") }),
]);
export type DecisionInput = z.infer<typeof decisionSchema>;
