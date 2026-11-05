// Demo data ported from the prototype (docs/prototype, seed* methods).
// Plain data only — prisma/seed.ts turns it into database rows.
import type { Role } from "@crms/shared";

export const DEMO_PASSWORD = "demo-password"; // dev only — every seeded user

/** The nine demo personas, one per role (prototype ROLES). */
export const PERSONAS: { name: string; role: Role; title: string; dept: string }[] = [
  { name: "Ama Mensah", role: "requester", title: "Claims Officer", dept: "Claims" },
  { name: "Kwame Boateng", role: "lineManager", title: "Claims Supervisor", dept: "Claims" },
  { name: "Efua Asante", role: "deptHead", title: "Head of Claims", dept: "Claims" },
  { name: "Yaw Owusu", role: "changeManager", title: "Change & Release Manager", dept: "IT" },
  { name: "Akosua Darko", role: "cab", title: "CAB Chair", dept: "Operations" },
  { name: "Nana Agyeman", role: "risk", title: "Compliance Officer", dept: "Compliance" },
  { name: "Kojo Frimpong", role: "implementer", title: "Systems Engineer", dept: "IT" },
  { name: "Abena Osei", role: "exec", title: "Chief Operating Officer", dept: "Operations" },
  { name: "Selorm Dzidzienyo", role: "admin", title: "IAM Administrator", dept: "IT" },
];

/** Who acts for each role in the demo (used as the decider on seeded approvals). */
export const personaFor = (role: Role) => PERSONAS.find((p) => p.role === role)!.name;

type Status = "Active" | "Invited" | "Disabled";

export const OTHER_USERS: { name: string; role: Role; dept: string; status: Status; title?: string }[] = [
  { name: "Christiana Kyei", role: "deptHead", dept: "Underwriting", status: "Active" },
  { name: "Martin Amudzi", role: "deptHead", dept: "Finance", status: "Active" },
  { name: "Safoa Awuku-Asabre", role: "deptHead", dept: "HR", status: "Active" },
  { name: "Kofi Ntim", role: "deptHead", dept: "Actuarial", status: "Active" },
  { name: "Victor Aggrey-fynn", role: "lineManager", dept: "Operations", status: "Active" },
  { name: "Michael Obeng", role: "implementer", dept: "IT", status: "Active" },
  { name: "Mudassiru Akanni", role: "requester", dept: "Sales & Distribution", status: "Invited" },
  { name: "Kafui Philomena", role: "requester", dept: "Customer Service", status: "Disabled" },
  ...(
    [
      "Kwabena Ofori|IT|implementer", "Yaa Asantewaa|Claims|requester", "Kweku Badu|Finance|requester",
      "Abena Mensah|Underwriting|requester", "Kojo Asare|Sales & Distribution|lineManager",
      "Ama Serwaa|Customer Service|requester", "Kofi Boakye|Operations|requester", "Akosua Frimpong|HR|requester",
      "Efua Quansah|Actuarial|requester", "Kwame Ansah|IT|implementer", "Adwoa Pokua|Claims|requester",
      "Esi Arthur|Compliance|risk", "Fiifi Sam|Finance|lineManager", "Selasi Agbeko|IT|requester",
      "Edem Kpodo|Underwriting|requester", "Dzifa Ahiable|Customer Service|lineManager",
      "Mawuli Tetteh|Operations|implementer", "Naa Adjeley Lamptey|Sales & Distribution|requester",
      "Nii Armah|IT|cab", "Ekow Hagan|Finance|requester",
    ] as const
  ).map((row, i) => {
    const [name, dept, role] = row.split("|") as [string, string, Role];
    const status: Status = i === 6 || i === 15 ? "Invited" : i === 11 ? "Disabled" : "Active";
    return { name, role, dept, status };
  }),
  // Not in the prototype. Placeholder names — rename to real staff when known.
  // Appended last so existing user codes (USR-0201…) don't shift.
  { name: "Deputy Change Manager", role: "changeManager", dept: "IT", status: "Active", title: "Deputy Change & Release Manager" },
  { name: "Super Admin", role: "superAdmin", dept: "IT", status: "Active", title: "Super Administrator" },
];

/** [code, name, head, line manager] */
export const DEPARTMENTS: [string, string, string, string][] = [
  ["CLM", "Claims", "Efua Asante", "Kwame Boateng"],
  ["UW", "Underwriting", "Christiana Kyei", "Kwame Boateng"],
  ["FIN", "Finance", "Martin Amudzi", "Kwame Boateng"],
  ["IT", "IT", "Yaw Owusu", "Kojo Frimpong"],
  ["HR", "HR", "Safoa Awuku-Asabre", "Kwame Boateng"],
  ["CS", "Customer Service", "Efua Asante", "Kwame Boateng"],
  ["ACT", "Actuarial", "Kofi Ntim", "Kwame Boateng"],
  ["SD", "Sales & Distribution", "Abena Osei", "Kwame Boateng"],
  ["CMP", "Compliance", "Nana Agyeman", "Kwame Boateng"],
  ["OPS", "Operations", "Akosua Darko", "Victor Aggrey-fynn"],
];

export const CHANGE_TYPES: [string, string][] = [
  ["IT / system", "Applications, infrastructure, integrations, data"],
  ["Process / policy", "Operating procedures, SOPs, internal policies"],
  ["Product", "New or modified insurance products & pricing"],
  ["Organisational / HR", "Structure, roles, HR policy, payroll"],
  ["Infrastructure / facilities", "Buildings, branches, power, physical security"],
  ["Vendor / third-party", "Onboarding, replacing or changing suppliers"],
];

export const FREEZES = [
  { name: "Month-end financial close", from: "2026-10-28", to: "2026-11-02" },
  { name: "Month-end financial close", from: "2026-11-27", to: "2026-12-02" },
  { name: "Year-end freeze", from: "2026-12-14", to: "2027-01-04" },
];

type Tier = "Low" | "Medium" | "High" | "Emergency";
/** Department overrides (null = company default). Prototype seedWF. */
export const WORKFLOWS: { dept: string | null; routes: Record<Tier, Role[]> }[] = (() => {
  const def: Record<Tier, Role[]> = {
    Low: ["lineManager"],
    Medium: ["lineManager", "deptHead", "changeManager"],
    High: ["lineManager", "deptHead", "risk", "cab", "changeManager"],
    Emergency: ["changeManager", "cab"],
  };
  return [
    { dept: null, routes: def },
    {
      dept: "IT",
      routes: { ...def, Low: ["changeManager"], Medium: ["lineManager", "changeManager", "cab"] },
    },
    { dept: "Underwriting", routes: { ...def, High: [...def.High, "exec"] } },
    {
      dept: "Finance",
      routes: {
        ...def,
        Medium: ["lineManager", "deptHead", "risk", "changeManager"],
        High: [...def.High, "exec"],
      },
    },
  ];
})();

// ---------------------------------------------------------------- changes

type StepStatus = "waiting" | "pending" | "approved" | "rejected" | "returned" | "skipped";
export type SeedStep = { role: Role; status: StepStatus; at?: string; comment?: string };
export type SeedChange = {
  ref: string; title: string; type: string; dept: string; impact: number; likelihood: number; tier: Tier;
  status: string; requester: string; created: string; date: string; window: string; implementer: string | null;
  summary: string; reason: string; systems: string[]; customer: boolean; regulatory: boolean; data: boolean;
  rollback: string; test: string; steps: SeedStep[]; tasks: { label: string; done: boolean }[];
  files?: { name: string; size: string }[]; pir?: { outcome: string; notes: string; at: string } | null;
};

const s = (role: Role, status: StepStatus, at?: string, comment?: string): SeedStep => ({ role, status, at, comment });
const T = (labels: string[], doneCount: number) => labels.map((label, i) => ({ label, done: i < doneCount }));
const tasksIT = ["Confirm change window with service desk", "Take backups / snapshots", "Deploy to production", "Run smoke tests", "Notify stakeholders of completion"];

export const CHANGES: SeedChange[] = [
  { ref: "CHG-2026-0144", title: "Add mobile money payout option to claims portal", type: "IT / system", dept: "Claims", impact: 2, likelihood: 2, tier: "Medium", status: "Pending approval", requester: "Ama Mensah", created: "2026-10-21", date: "2026-11-05", window: "22:00–02:00", implementer: "Kojo Frimpong", summary: "Enable MTN MoMo and Telecel Cash as payout channels for approved funeral and hospital-cash claims.", reason: "Most claimants request mobile money payout; bank transfers add 2–3 days to settlement.", systems: ["Claims portal", "Payments gateway"], customer: true, regulatory: false, data: true, rollback: "Disable feature flag and revert to bank-only payout. No data migration.", test: "UAT with 20 test claims in staging; Finance reconciliation sign-off.", steps: [s("lineManager", "pending"), s("deptHead", "waiting"), s("changeManager", "waiting")], tasks: T(tasksIT, 0) },
  { ref: "CHG-2026-0142", title: "Upgrade core policy administration system to v8.2", type: "IT / system", dept: "IT", impact: 3, likelihood: 2, tier: "High", status: "Pending approval", requester: "Kojo Frimpong", created: "2026-10-14", date: "2026-11-07", window: "Sat 20:00 – Sun 06:00", implementer: "Kojo Frimpong", summary: "Upgrade the policy admin platform from v7.9 to v8.2, including database schema migration and new premium-allocation engine.", reason: "v7.9 reaches end of vendor support in December 2026; v8.2 resolves two high-severity security findings.", systems: ["Policy admin", "Premium billing", "Agent portal", "Data warehouse"], customer: true, regulatory: true, data: true, rollback: "Restore database snapshot and VM images taken at T-0; DNS cut back to v7.9 cluster. Tested in DR rehearsal on 10 Oct.", test: "Full regression suite (1,240 cases) passed in pre-prod; performance test at 2× peak load.", files: [{ name: "v8.2-upgrade-runbook.pdf", size: "2.4 MB" }, { name: "regression-results.xlsx", size: "318 KB" }, { name: "dr-rehearsal-signoff.pdf", size: "540 KB" }], steps: [s("lineManager", "approved", "15 Oct 2026, 09:12", "Plan reviewed with infra team."), s("deptHead", "approved", "16 Oct 2026, 14:40"), s("risk", "approved", "20 Oct 2026, 11:05", "No change to NIC reporting outputs confirmed by Actuarial."), s("cab", "pending"), s("changeManager", "waiting")], tasks: T(tasksIT, 0) },
  { ref: "CHG-2026-0141", title: "Revise claims payout approval thresholds", type: "Process / policy", dept: "Claims", impact: 2, likelihood: 1, tier: "Medium", status: "Pending approval", requester: "Ama Mensah", created: "2026-10-18", date: "2026-11-09", window: "Effective from start of business", implementer: "Efua Asante", summary: "Raise the supervisor sign-off threshold for death claims from GHS 20,000 to GHS 35,000 and introduce dual control above GHS 100,000.", reason: "Reduces average settlement time while strengthening control on high-value claims.", systems: ["Claims SOP", "Delegation of authority matrix"], customer: false, regulatory: true, data: false, rollback: "Reissue previous SOP version; revert DoA matrix.", test: "Walk-through with claims team; Internal Audit review of revised matrix.", steps: [s("lineManager", "approved", "19 Oct 2026, 10:30"), s("deptHead", "pending"), s("changeManager", "waiting")], tasks: T(["Publish revised SOP", "Update DoA matrix in claims system", "Brief claims team"], 0) },
  { ref: "CHG-2026-0139", title: "Launch “miFuneral Plus” product", type: "Product", dept: "Underwriting", impact: 3, likelihood: 2, tier: "High", status: "Pending approval", requester: "Christiana Kyei", created: "2026-10-09", date: "2026-11-16", window: "Go-live 08:00", implementer: "Kojo Frimpong", summary: "New funeral cover with family add-ons and cash-back after 5 claim-free years, sold through agents and USSD.", reason: "Addresses demand in the informal sector; projected 8,000 policies in year one.", systems: ["Policy admin", "USSD channel", "Agent app", "Product rules"], customer: true, regulatory: true, data: true, rollback: "Withdraw product from sale channels; existing policies remain serviced.", test: "Pricing signed off by Actuarial; channel UAT complete.", steps: [s("lineManager", "approved", "10 Oct 2026, 08:50"), s("deptHead", "approved", "13 Oct 2026, 16:20"), s("risk", "pending"), s("cab", "waiting"), s("changeManager", "waiting"), s("exec", "waiting")], tasks: T(["Configure product rules", "Load rates", "Enable on agent app & USSD", "Train agents"], 0) },
  { ref: "CHG-2026-0138", title: "Migrate payroll processing to new provider", type: "Vendor / third-party", dept: "HR", impact: 2, likelihood: 2, tier: "Medium", status: "Scheduled", requester: "Safoa Awuku-Asabre", created: "2026-10-01", date: "2026-10-26", window: "09:00–17:00", implementer: "Kojo Frimpong", summary: "Move payroll from in-house spreadsheet process to managed payroll provider with SSNIT and GRA integration.", reason: "Removes manual errors and key-person dependency.", systems: ["Payroll", "HRIS", "GL interface"], customer: false, regulatory: true, data: true, rollback: "Run October payroll in parallel on legacy process.", test: "Parallel run for September payroll reconciled to the pesewa.", steps: [s("lineManager", "approved", "02 Oct 2026, 09:00"), s("deptHead", "approved", "03 Oct 2026, 12:10"), s("changeManager", "approved", "06 Oct 2026, 15:45")], tasks: T(["Data transfer agreement signed", "Employee master data loaded", "Parallel run reconciled", "Cut over"], 3) },
  { ref: "CHG-2026-0137", title: "Emergency: renew payment gateway TLS certificate", type: "IT / system", dept: "IT", impact: 3, likelihood: 1, tier: "Emergency", status: "Implemented", requester: "Kojo Frimpong", created: "2026-10-19", date: "2026-10-19", window: "14:30–15:00", implementer: "Kojo Frimpong", summary: "Certificate on the mobile money payment gateway expired early due to CA revocation; premium collections were failing.", reason: "Restore premium collections.", systems: ["Payments gateway"], customer: true, regulatory: false, data: false, rollback: "N/A — restoring service.", test: "Test transaction confirmed.", steps: [s("changeManager", "approved", "19 Oct 2026, 14:22", "ECAB call held."), s("cab", "approved", "19 Oct 2026, 14:25")], tasks: T(["Install new certificate", "Restart gateway", "Confirm test transaction"], 3) },
  { ref: "CHG-2026-0135", title: "Restructure Customer Service into regional teams", type: "Organisational / HR", dept: "Customer Service", impact: 2, likelihood: 2, tier: "Medium", status: "Draft", requester: "Ama Mensah", created: "2026-10-20", date: "2026-12-01", window: "Effective 1 Dec", implementer: "Efua Asante", summary: "Organise the contact centre into Southern, Middle and Northern regional teams with dedicated team leads.", reason: "Improve local language coverage and first-contact resolution.", systems: ["Org chart", "Call routing"], customer: true, regulatory: false, data: false, rollback: "Revert routing rules; teams return to central queue.", test: "Pilot with Northern team for 2 weeks.", steps: [s("lineManager", "waiting"), s("deptHead", "waiting"), s("changeManager", "waiting")], tasks: T(["Consult staff", "Update routing", "Announce"], 0) },
  { ref: "CHG-2026-0133", title: "Replace UPS units at Accra head office", type: "Infrastructure / facilities", dept: "Operations", impact: 1, likelihood: 2, tier: "Low", status: "In progress", requester: "Victor Aggrey-fynn", created: "2026-10-05", date: "2026-10-22", window: "18:00–23:00", implementer: "Kojo Frimpong", summary: "Swap two 20kVA UPS units serving the server room and 2nd floor.", reason: "Units are 9 years old; battery tests failed.", systems: ["Server room power", "2nd floor"], customer: false, regulatory: false, data: false, rollback: "Reconnect existing units (kept on site for 7 days).", test: "Load test after installation.", steps: [s("lineManager", "approved", "06 Oct 2026, 11:00")], tasks: T(["Notify building occupants", "Switch to generator", "Install new UPS", "Load test", "Return to mains"], 2) },
  { ref: "CHG-2026-0136", title: "Refresh IFRS 17 actuarial models", type: "IT / system", dept: "Actuarial", impact: 2, likelihood: 2, tier: "Medium", status: "Scheduled", requester: "Kofi Ntim", created: "2026-10-07", date: "2026-11-04", window: "08:00–12:00", implementer: "Kojo Frimpong", summary: "Deploy updated assumption set and model version for Q4 valuation.", reason: "Annual assumption review approved by the Board Risk Committee.", systems: ["Actuarial models", "Data warehouse"], customer: false, regulatory: true, data: false, rollback: "Restore previous model version from repository.", test: "Back-test on Q3 results.", steps: [s("lineManager", "approved", "08 Oct 2026, 10:00"), s("deptHead", "approved", "09 Oct 2026, 09:15"), s("changeManager", "approved", "12 Oct 2026, 13:00")], tasks: T(["Deploy model", "Run validation", "Sign-off"], 0) },
  { ref: "CHG-2026-0130", title: "Onboard new reinsurance broker", type: "Vendor / third-party", dept: "Finance", impact: 3, likelihood: 2, tier: "High", status: "Rejected", requester: "Martin Amudzi", created: "2026-09-24", date: "2026-10-15", window: "—", implementer: null, summary: "Appoint an additional reinsurance broker for the group life treaty.", reason: "Improve treaty pricing at renewal.", systems: ["Reinsurance treaty", "Vendor register"], customer: false, regulatory: true, data: true, rollback: "—", test: "—", steps: [s("lineManager", "approved", "25 Sep 2026, 09:00"), s("deptHead", "approved", "26 Sep 2026, 10:00"), s("risk", "rejected", "30 Sep 2026, 15:20", "Due diligence incomplete: no evidence of NIC licence renewal and no data processing agreement."), s("cab", "skipped"), s("changeManager", "skipped")], tasks: [] },
  { ref: "CHG-2026-0128", title: "Quarterly firewall rule review", type: "IT / system", dept: "IT", impact: 1, likelihood: 1, tier: "Low", status: "Closed", requester: "Kojo Frimpong", created: "2026-10-01", date: "2026-10-08", window: "20:00–21:00", implementer: "Kojo Frimpong", summary: "Remove 34 unused firewall rules identified in quarterly review.", reason: "Reduce attack surface.", systems: ["Perimeter firewall"], customer: false, regulatory: false, data: false, rollback: "Restore rule set from config backup.", test: "Connectivity checks to all critical services.", steps: [s("changeManager", "approved", "02 Oct 2026, 09:30")], tasks: T(["Backup config", "Remove rules", "Connectivity checks"], 3), pir: { outcome: "Successful", notes: "All rules removed; no service impact reported.", at: "09 Oct 2026, 16:40" } },
  ...historicalChanges(),
];

/** 28 closed/rejected changes from Jul–Sep 2026 (prototype histChanges). */
function historicalChanges(): SeedChange[] {
  const titles = ["Patch Windows servers (monthly)", "Update agent commission rates", "Renew SSL certificates — portal", "Migrate email to new tenant", "Add USSD short code for claims", "Revise underwriting guidelines — group life", "Replace branch printers — Kumasi", "Onboard SMS gateway provider", "Database index optimisation — billing", "Update KYC procedure", "Retire legacy fax claims intake", "Upgrade VPN concentrators", "New hospital-cash rider", "Change payroll cut-off date", "Refresh call-centre IVR menu", "Rotate service account credentials", "Move backups to new storage", "Update data retention policy", "Install CCTV — Takoradi branch", "Change premium grace period", "Add Telecel Cash collections", "Upgrade HRIS to latest release", "Revise travel & expense policy", "Decommission old intranet", "Update reinsurance bordereaux format", "Firewall upgrade — DR site", "New complaints-handling SOP", "Switch fuel card vendor"];
  const depts = ["IT", "Sales & Distribution", "IT", "IT", "Claims", "Underwriting", "Operations", "IT", "IT", "Compliance", "Claims", "IT", "Underwriting", "HR", "Customer Service", "IT", "IT", "Compliance", "Operations", "Finance", "Finance", "HR", "Finance", "IT", "Finance", "IT", "Customer Service", "Operations"];
  const typeFor: Record<string, string> = { IT: "IT / system", HR: "Organisational / HR", Operations: "Infrastructure / facilities", Compliance: "Process / policy", Finance: "Process / policy", Claims: "Process / policy", "Customer Service": "Process / policy", Underwriting: "Product", "Sales & Distribution": "Process / policy" };
  const requesters = ["Kojo Frimpong", "Ama Mensah", "Christiana Kyei", "Martin Amudzi", "Safoa Awuku-Asabre"];

  return titles.map((title, i) => {
    const m = 7 + Math.floor(i / 10);
    const day = String(3 + ((i * 3) % 25)).padStart(2, "0");
    const mon = ["Jul", "Aug", "Sep"][m - 7]!;
    const impact = 1 + (i % 3), likelihood = 1 + ((i + 1) % 2);
    const sc = impact * likelihood;
    const tier: Tier = sc <= 2 ? "Low" : sc <= 4 ? "Medium" : "High";
    const rejected = i % 9 === 4;
    const route: Role[] = tier === "Low" ? ["lineManager"] : tier === "Medium" ? ["lineManager", "deptHead", "changeManager"] : ["lineManager", "deptHead", "risk", "cab", "changeManager"];
    const steps = route.map((role, k) => {
      const last = rejected && k === route.length - 1;
      return s(role, last ? "rejected" : "approved", `${day} ${mon} 2026, 10:${String(10 + k * 7).padStart(2, "0")}`, last ? "Insufficient testing evidence." : undefined);
    });
    const dept = depts[i]!;
    return {
      ref: "CHG-2026-0" + String(100 + i).padStart(3, "0"), title, type: i === 27 ? "Vendor / third-party" : typeFor[dept]!, dept,
      impact, likelihood, tier, status: rejected ? "Rejected" : "Closed", requester: requesters[i % 5]!,
      created: `2026-0${m}-01`, date: `2026-0${m}-${day}`, window: "20:00–23:00", implementer: rejected ? null : "Kojo Frimpong",
      summary: title + ".", reason: "Routine improvement.", systems: [dept], customer: i % 2 === 0, regulatory: i % 4 === 0, data: i % 3 === 0,
      rollback: "Restore previous configuration.", test: "Verified in staging.", steps,
      tasks: [{ label: "Implement", done: !rejected }, { label: "Verify", done: !rejected }],
      pir: rejected ? null : { outcome: i % 11 === 3 ? "Successful with issues" : "Successful", notes: "Completed within window.", at: `${day} ${mon} 2026, 16:40` },
    };
  });
}

// ---------------------------------------------------------------- audit

/** Hand-written recent events from the prototype; seed.ts adds events for historical changes. */
export const AUDIT: { ts: string; user: string; role: Role; action: string; ref: string; ip: string }[] = (
  [
    ["22 Oct 2026 09:41", "Yaw Owusu", "changeManager", "Signed in", "—", "10.20.4.18"],
    ["22 Oct 2026 08:15", "Kojo Frimpong", "implementer", "Started implementation", "CHG-2026-0133", "10.20.6.42"],
    ["21 Oct 2026 16:02", "Ama Mensah", "requester", "Submitted change request", "CHG-2026-0144", "10.20.8.11"],
    ["20 Oct 2026 11:05", "Nana Agyeman", "risk", "Approved at Risk & Compliance stage", "CHG-2026-0142", "10.20.3.77"],
    ["20 Oct 2026 10:12", "Selorm Dzidzienyo", "admin", "Assigned role CAB Member to Akosua Darko", "USR-0217", "10.20.1.5"],
    ["19 Oct 2026 15:04", "Kojo Frimpong", "implementer", "Marked as implemented", "CHG-2026-0137", "10.20.6.42"],
    ["19 Oct 2026 14:25", "Akosua Darko", "cab", "Approved (Emergency CAB)", "CHG-2026-0137", "102.176.4.9"],
    ["19 Oct 2026 14:22", "Yaw Owusu", "changeManager", "Approved (Emergency CAB)", "CHG-2026-0137", "10.20.4.18"],
    ["19 Oct 2026 10:30", "Kwame Boateng", "lineManager", "Approved at Line Manager stage", "CHG-2026-0141", "10.20.8.20"],
    ["16 Oct 2026 14:40", "Efua Asante", "deptHead", "Approved at Department Head stage", "CHG-2026-0142", "10.20.8.3"],
    ["15 Oct 2026 17:48", "Selorm Dzidzienyo", "admin", "Updated workflow: Underwriting · High", "WF-UW-HIGH", "10.20.1.5"],
    ["14 Oct 2026 09:02", "Kojo Frimpong", "implementer", "Submitted change request", "CHG-2026-0142", "10.20.6.42"],
    ["30 Sep 2026 15:20", "Nana Agyeman", "risk", "Rejected at Risk & Compliance stage", "CHG-2026-0130", "10.20.3.77"],
  ] as const
).map(([ts, user, role, action, ref, ip]) => ({ ts, user, role, action, ref, ip }));

/** Prototype auditCat: which filter bucket an action belongs to. */
export function auditCategory(action: string) {
  if (/Signed in|access/i.test(action)) return "signin";
  if (/^(Approved|Rejected|Returned)/.test(action)) return "decision";
  if (/Export|Imported/.test(action)) return "export";
  if (/workflow|department|change type|Invited|Disabled|Enabled|Moved|Changed role|Set |Assigned role|password/i.test(action)) return "config";
  return "change";
}
