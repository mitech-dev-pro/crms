// Shapes of the JSON the API returns. The backend's DTO functions are typed
// against these, so if one side changes the other stops compiling.
// Dates travel as ISO strings ("2026-11-05T14:30:00.000Z"); plain dates as "YYYY-MM-DD".
import type { AuditCategory } from "./schemas/audit";
import type { ChangeStatus, PirOutcome, RiskTier, Role, StepStatus } from "./enums";

export type ApiErrorBody = { error: { code: string; message: string; fields?: Record<string, string> } };

type Ref = { id: string; name: string };

export type CurrentStage = { role: Role; label: string; index: number; total: number } | null;

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

export type AuditListResponse = {
  items: { id: string; at: string; userName: string; role: Role | null; action: string; category: AuditCategory; ref: string | null; ip: string | null }[];
  total: number;
  page: number;
  pageSize: number;
};
