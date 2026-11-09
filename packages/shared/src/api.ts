// Shapes of the JSON the API returns. The backend's DTO functions are typed
// against these, so if one side changes the other stops compiling.
// Dates travel as ISO strings ("2026-11-05T14:30:00.000Z"); plain dates as "YYYY-MM-DD".
import type { AuditCategory } from "./schemas/audit";
import type { ChangeStatus, PirOutcome, RiskTier, Role, StepStatus } from "./enums";

export type ApiErrorBody = { error: { code: string; message: string; fields?: Record<string, string> } };

type Ref = { id: string; name: string };

/** pendingSince/dueAt: ISO timestamps; due 2 working days after the stage started waiting. */
export type CurrentStage = { role: Role; label: string; index: number; total: number; pendingSince: string | null; dueAt: string | null } | null;

export type ChangeListItem = {
  id: string;
  ref: string;
  title: string;
  status: ChangeStatus;
  tier: RiskTier;
  risk: "Low" | "Medium" | "High";
  score: number;
  type: { id: string; label: string };
  department: Ref;
  requester: Ref;
  implementer: Ref | null;
  plannedDate: string | null;
  window: string | null;
  createdAt: string;
  currentStage: CurrentStage;
};

export type ChangeListResponse = {
  items: ChangeListItem[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<ChangeStatus, number>;
};

export type ChangeActions = {
  edit: boolean;
  submit: boolean;
  decide: boolean;
  sodBlocked: boolean;
  override: boolean;
  start: boolean;
  updateTasks: boolean;
  markImplemented: boolean;
  review: boolean;
  attach: boolean;
  removeAttachment: boolean;
  /** Anyone who can see the change can join its discussion. */
  comment: boolean;
  /** Set when you can decide only as a stand-in: the name of the approver you're covering for. */
  standInFor: string | null;
};

export type ApprovalStepDto = {
  id: string;
  order: number;
  role: Role;
  roleLabel: string;
  status: StepStatus;
  decidedBy: Ref | null;
  decidedAt: string | null;
  comment: string | null;
  overridden: boolean;
  /** When a stand-in decided: the approver they were covering for. */
  onBehalfOf: Ref | null;
};

export type CommentDto = { id: string; author: Ref & { role: Role }; body: string; createdAt: string };

/** A stand-in arrangement. Dates are inclusive "YYYY-MM-DD". */
export type StandInDto = {
  id: string;
  from: Ref & { role: Role };
  to: Ref & { role: Role };
  startsOn: string;
  endsOn: string;
  reason: string | null;
  createdBy: Ref;
  /** "upcoming" | "active" | "ended" (past its end date or revoked). */
  state: "upcoming" | "active" | "ended";
};

export type ActivityItem = { id: string; at: string; userName: string; role: Role | null; action: string; category: string };

export type ChangeDetail = Omit<ChangeListItem, "requester"> & {
  summary: string;
  reason: string;
  emergency: boolean;
  impact: number;
  likelihood: number;
  customerFacing: boolean;
  regulatory: boolean;
  personalData: boolean;
  systems: string[];
  testPlan: string | null;
  rollbackPlan: string | null;
  requester: Ref & { role: Role };
  updatedAt: string;
  submittedAt: string | null;
  steps: ApprovalStepDto[];
  tasks: { id: string; order: number; label: string; done: boolean; doneAt: string | null; doneBy: Ref | null }[];
  attachments: { id: string; fileName: string; sizeBytes: number; uploadedAt: string }[];
  pir: { outcome: PirOutcome; notes: string; reviewedBy: Ref; reviewedAt: string } | null;
  actions: ChangeActions;
  activity: ActivityItem[];
  comments: CommentDto[];
};

export type InboxResponse = { items: ChangeListItem[] };

export type MetaResponse = {
  departments: { id: string; code: string; name: string }[];
  changeTypes: { id: string; label: string; description: string }[];
  implementers: Ref[];
  freezes: { name: string; from: string; to: string }[];
};

export type RoutePreview = {
  tier: RiskTier;
  score: number;
  risk: "Low" | "Medium" | "High";
  route: { role: Role; label: string }[];
  freeze: { name: string; from: string; to: string } | null;
};

export type FreezeDto = { id: string; name: string; from: string; to: string };

export type CalendarResponse = { items: ChangeListItem[]; freezes: FreezeDto[] };

/** Effective routes: the company default plus each department's overrides. */
export type WorkflowsResponse = {
  departments: { id: string; code: string; name: string; active: boolean }[];
  default: Record<RiskTier, Role[]>;
  overrides: Record<string, Partial<Record<RiskTier, Role[]>>>; // keyed by department id
};

export type ReportsResponse = {
  /** from / to: inclusive "YYYY-MM-DD", null when open-ended. */
  period: { key: "quarter" | "year" | "all" | "custom"; label: string; from: string | null; to: string | null };
  kpis: {
    raised: number;
    approvalRate: number | null; // approved ÷ (approved + rejected), 0–1
    avgApprovalDays: number | null; // submit → last approval
    successRate: number | null; // successful PIRs ÷ all PIRs, 0–1
    emergencies: number;
    rejected: number;
  };
  byDepartment: { name: string; count: number }[];
  byTier: Record<RiskTier, number>;
  byStatus: Record<ChangeStatus, number>;
  monthly: { month: string; label: string; raised: number; successful: number; failed: number }[];
  decisionTimeByRole: { role: Role; label: string; avgHours: number; decisions: number }[];
};

export type AdminDepartment = {
  id: string; code: string; name: string; active: boolean;
  head: Ref | null; lineManager: Ref | null; userCount: number; hasCustomRoute: boolean;
};

export type AdminChangeType = { id: string; label: string; description: string; active: boolean; changeCount: number };

export type AdminUser = {
  id: string; code: string; name: string; email: string; title: string | null; role: Role;
  status: "Active" | "Invited" | "Disabled"; department: Ref; lastLoginAt: string | null;
};

export type AdminUserListResponse = {
  items: AdminUser[]; total: number; page: number; pageSize: number;
  counts: Record<"Active" | "Invited" | "Disabled", number>;
};

export type UserImportResult = {
  dryRun: boolean;
  created: number;
  results: { row: number; email: string; ok: boolean; errors: string[] }[];
};

export type AuditListResponse = {
  items: { id: string; at: string; userName: string; role: Role | null; action: string; category: AuditCategory; ref: string | null; ip: string | null }[];
  total: number;
  page: number;
  pageSize: number;
};
