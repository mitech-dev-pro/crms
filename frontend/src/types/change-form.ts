
export const CHANGE_TYPES = [
  "IT / System Change",
  "Process / Policy Change",
  "Product Change",
  "Organisational / HR Change",
  "Infrastructure / Facilities Change",
] as const;

export type ChangeType = (typeof CHANGE_TYPES)[number];

export type ChangeFormData = {
  title: string;
  changeType: ChangeType | "";
  department: string;
  priority: "Low" | "Medium" | "High";
  description: string;
  justification: string;

  //Step 2 : Risk & Impact Assessment
  impactLevel: "Low" | "Medium" | "High" | "";
  affectedSystems: string;
  riskDescription: string;
  mitigationPlan: string;

  // Step 3: Implementation
  plannedDate: string;
  implementationPlan: string;
  rollbackPlan: string;
  testPlan: string;
};

// this represents a function type that takes a field name and a value, and updates the corresponding field in the ChangeFormData object. The generic type K extends keyof ChangeFormData ensures that the field parameter is one of the keys of ChangeFormData, and the value parameter is of the corresponding type for that key.
export type UpdateChangeField = <
  K extends keyof ChangeFormData
>(
  field: K,
  value: ChangeFormData[K]
) => void;