// Fixed vocabularies used by the frontend, the backend and the Prisma schema.
// Keys match the Prisma enum values; labels are what the UI shows.

export const ROLES = [
  "requester",
  "lineManager",
  "deptHead",
  "changeManager",
  "cab",
  "risk",
  "implementer",
  "exec",
  "admin",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  requester: "Requester",
  lineManager: "Line Manager",
  deptHead: "Department Head",
  changeManager: "Change Manager",
  cab: "CAB Member",
  risk: "Risk & Compliance",
  implementer: "Implementer",
  exec: "Executive",
  admin: "System Admin",
};

export const RISK_TIERS = ["Low", "Medium", "High", "Emergency"] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

export const CHANGE_STATUSES = [
  "Draft",
  "PendingApproval",
  "ReturnedForRework",
  "Approved",
  "Scheduled",
  "InProgress",
  "Implemented",
  "Closed",
  "Rejected",
] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

export const CHANGE_STATUS_LABELS: Record<ChangeStatus, string> = {
  Draft: "Draft",
  PendingApproval: "Pending approval",
  ReturnedForRework: "Returned for rework",
  Approved: "Approved",
  Scheduled: "Scheduled",
  InProgress: "In progress",
  Implemented: "Implemented",
  Closed: "Closed",
  Rejected: "Rejected",
};

export const STEP_STATUSES = ["waiting", "pending", "approved", "rejected", "returned", "skipped"] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

// Screens a role may open. The sidebar uses this to hide links and the API
// uses it to return 403 — the same list on both sides.
export const SCREENS = [
  "dashboard",
  "changes",
  "new",
  "approvals",
  "calendar",
  "flows",
  "reports",
  "audit",
  "admin",
] as const;
export type Screen = (typeof SCREENS)[number];

export const PERMS: Record<Role, readonly Screen[]> = {
  requester: ["dashboard", "changes", "new", "calendar", "flows"],
  lineManager: ["dashboard", "changes", "new", "approvals", "calendar", "flows"],
  deptHead: ["dashboard", "changes", "new", "approvals", "calendar", "flows", "reports"],
  changeManager: ["dashboard", "changes", "new", "approvals", "calendar", "flows", "reports", "audit"],
  cab: ["dashboard", "changes", "approvals", "calendar", "flows", "reports"],
  risk: ["dashboard", "changes", "approvals", "calendar", "flows", "reports", "audit"],
  implementer: ["dashboard", "changes", "calendar", "flows"],
  exec: ["dashboard", "changes", "approvals", "calendar", "flows", "reports"],
  admin: ["dashboard", "admin", "audit", "flows"],
};

export const can = (role: Role, screen: Screen): boolean => PERMS[role].includes(screen);
