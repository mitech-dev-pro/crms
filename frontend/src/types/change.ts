export type ChangePriority = "Low" | "Medium" | "High";

export type ChangeStatus =
  | "Pending"
  | "In Progress"
  | "Completed";

export interface ChangeRequest {
  id: number;
  title: string;
  description: string;
  priority: ChangePriority;
  status: ChangeStatus;
  requester: string;
}