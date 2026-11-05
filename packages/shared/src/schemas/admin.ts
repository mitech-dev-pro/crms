import { z } from "zod";
import { RISK_TIERS, ROLES, type Role } from "../enums";

/** Roles that can be a stage in an approval route. */
export const APPROVER_ROLES = ["lineManager", "deptHead", "risk", "cab", "changeManager", "exec"] as const satisfies readonly Role[];
export type ApproverRole = (typeof APPROVER_ROLES)[number];
export const isApproverRole = (r: Role): r is ApproverRole => (APPROVER_ROLES as readonly Role[]).includes(r);

/** Granting or removing these needs a super admin, so an admin can't promote themselves or a friend. */
export const PRIVILEGED_ROLES: readonly Role[] = ["admin", "superAdmin"];

/** May `actor` change a user from `from` to `to`? (The API also blocks changing yourself.) */
export const canAssignRole = (actor: Role, from: Role, to: Role) =>
  actor === "superAdmin" || (!PRIVILEGED_ROLES.includes(from) && !PRIVILEGED_ROLES.includes(to));

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));
const name = z.string().trim().min(2, "Name is required").max(100);

// ------------------------------------------------------------------ departments

export const departmentCreateSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/, "2–6 letters or digits, e.g. CLM"),
  name: z.string().trim().min(2, "Name is required").max(60),
  headId: z.string().nullish(),
  lineManagerId: z.string().nullish(),
});
export const departmentUpdateSchema = departmentCreateSchema.partial().extend({ active: z.boolean().optional() });
export type DepartmentCreateInput = z.infer<typeof departmentCreateSchema>;
export type DepartmentUpdateInput = z.infer<typeof departmentUpdateSchema>;

// ------------------------------------------------------------------ change types

export const changeTypeCreateSchema = z.object({
  label: z.string().trim().min(2, "Label is required").max(60),
  description: z.string().trim().min(2, "Description is required").max(200),
});
export const changeTypeUpdateSchema = changeTypeCreateSchema.partial().extend({ active: z.boolean().optional() });
export type ChangeTypeCreateInput = z.infer<typeof changeTypeCreateSchema>;
export type ChangeTypeUpdateInput = z.infer<typeof changeTypeUpdateSchema>;

// ------------------------------------------------------------------ users

export const USER_STATUSES = ["Active", "Invited", "Disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const userInviteSchema = z.object({ name, email, departmentId: z.string().min(1, "Choose a department"), role: z.enum(ROLES) });
export type UserInviteInput = z.infer<typeof userInviteSchema>;

/** Admins enable/disable; "Invited" only changes by setting a password. */
export const userUpdateSchema = z.object({
  role: z.enum(ROLES).optional(),
  departmentId: z.string().min(1).optional(),
  status: z.enum(["Active", "Disabled"]).optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
  q: z.string().trim().optional(),
  role: z.enum(ROLES).optional(),
  departmentId: z.string().optional(),
  status: z.enum(USER_STATUSES).optional(),
});
export type UserListQuery = z.infer<typeof userListQuerySchema>;

/** CSV import: rows as parsed by the browser; department and role accept a name/code or label. */
export const userImportSchema = z.object({
  rows: z
    .array(z.object({ name: z.string(), email: z.string(), department: z.string(), role: z.string() }))
    .min(1, "The file has no rows")
    .max(500, "Import at most 500 users at a time"),
  dryRun: z.boolean().default(true),
});
export type UserImportInput = z.input<typeof userImportSchema>;

/** The template the Users screen offers for download. */
export const USER_IMPORT_TEMPLATE = "name,email,department,role\nAma Owusu,ama.owusu@milife.com.gh,Claims,Requester\n";

// ------------------------------------------------------------------ workflows

/** PUT /api/admin/workflows — replace one tier's route for a department, or the default (departmentId null). */
export const workflowUpdateSchema = z
  .object({
    departmentId: z.string().nullable(),
    tier: z.enum(RISK_TIERS),
    roles: z.array(z.enum(APPROVER_ROLES)).max(8, "At most 8 stages"),
  })
  .refine((w) => new Set(w.roles).size === w.roles.length, { message: "A role can appear only once in a route", path: ["roles"] })
  .refine((w) => w.departmentId !== null || w.roles.length > 0, { message: "The default route needs at least one stage", path: ["roles"] });
export type WorkflowUpdateInput = z.infer<typeof workflowUpdateSchema>;
