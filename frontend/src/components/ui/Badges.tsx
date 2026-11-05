import { CHANGE_STATUS_LABELS, type ChangeStatus, type RiskTier } from "@crms/shared";

type Tone = "amber" | "green" | "red" | "pink" | "blue" | "gray" | "cyan";

export function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold"
      style={{ background: `var(--${tone}-bg)`, color: `var(--${tone}-fg)` }}
    >
      {children}
    </span>
  );
}

// Colours match the prototype's STATUS map.
const statusTone: Record<ChangeStatus, Tone> = {
  Draft: "gray",
  PendingApproval: "amber",
  ReturnedForRework: "pink",
  Approved: "green",
  Scheduled: "blue",
  InProgress: "cyan",
  Implemented: "green",
  Closed: "gray",
  Rejected: "red",
};

export const StatusBadge = ({ status }: { status: ChangeStatus }) => <Pill tone={statusTone[status]}>{CHANGE_STATUS_LABELS[status]}</Pill>;

const riskTone: Record<string, Tone> = { Low: "green", Medium: "amber", High: "red", Emergency: "red" };

export const RiskBadge = ({ risk }: { risk: RiskTier | "Low" | "Medium" | "High" }) => (
  <Pill tone={riskTone[risk] ?? "gray"}>{risk === "Emergency" ? "Emergency" : `${risk} risk`}</Pill>
);

export const Mono = ({ children }: { children: React.ReactNode }) => (
  <span className="font-mono text-xs text-ink-2">{children}</span>
);
