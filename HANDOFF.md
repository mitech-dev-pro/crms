# MiLife Change Management — Build Handoff

> **Who this is for:** any developer or AI agent picking up this project, and the project owner, who wants to understand each step.
> **Teaching rule for agents:** after each change, explain in plain language **what** you did and **why**. Keep diffs small. Finish one phase before you start the next.

---

## 1. What we are building

An internal web app where any MiLife staff member can **raise a change request**. The request then moves through a **risk-based approval route**, gets **scheduled around freeze windows**, is **implemented against a checklist**, and is **closed after a post-implementation review**. Every action is written to an **audit trail**.

**Source of truth for the UI and behaviour:** the prototype in [`docs/prototype/`](docs/prototype/).
- `MiLife Change Management.dc.html`: the clickable prototype. Open it in a browser. It needs `support.js` beside it.
- `MiLife Change Management Deck.dc.html`: the overview deck.
- `shots/` and `assets/deck/`: screenshots of each screen. `assets/` also holds the logos.

The prototype is one HTML file with all of its logic in a `<script type="text/x-dc">` block near line 788. That block holds the seed data and the rules (`seedChanges`, `seedWF`, `decide`, `calcFor`, `PERMS`). **When a rule is unclear, read that block.** Sections 3 and 4 below summarise it.

---

## 2. Tech stack, and what each part does

| Layer | Tool | Its job here |
|---|---|---|
| UI | **Next.js 16 (App Router) + React 19** | Pages, routing and layouts. Already set up in `frontend/`. |
| Styling | **Tailwind CSS v4** | Utility classes. Prototype colours become theme tokens in `globals.css`. |
| Language | **TypeScript** everywhere | Catches mistakes before runtime. Frontend and backend share types. |
| API | **Express 5** (`backend/`) | REST API. The only code that talks to the database. |
| Validation | **Zod** (`packages/shared/`) | One schema validates on **both** sides: the form in the browser and the request body on the server. TS types are inferred from it. |
| Database | **MySQL 8** | Stores users, changes, approvals and audit records. |
| ORM | **Prisma** | Type-safe database access and migrations. Connects to MySQL through `@prisma/adapter-mariadb`, which works with any MySQL. |
| Data fetching (FE) | **TanStack Query** (recommended) | Caching, loading states and refetching after a mutation. |
| Forms (FE) | **React Hook Form + `@hookform/resolvers/zod`** (recommended) | Wizard state and validation, using the shared Zod schemas. |

### Why the frontend and backend are separate
Next.js could host the API itself. We chose **Express** so the business rules (approval routing, segregation of duties, audit) live in one backend that other clients could call later, such as a mobile app or integrations. **Rule: the frontend never touches the database. It calls the Express API.**

> ⚠️ **Next.js 16 note:** `frontend/AGENTS.md` warns that this Next version has breaking changes. Read `frontend/node_modules/next/dist/docs/` before writing Next-specific code (routing, `params`, caching, middleware/proxy).

---

## 3. Domain rules (from the prototype)

### 3.1 Roles (9)
| Key | Name | Main power |
|---|---|---|
| `requester` | Requester | Raise their own changes; sees only their own |
| `lineManager` | Line Manager | 1st approval stage |
| `deptHead` | Department Head | Approves for their department |
| `changeManager` | Change Manager | Approves, starts implementation, does the PIR and closes |
| `cab` | CAB Member | Reviews medium/high risk and Emergency CAB |
| `risk` | Risk & Compliance | Regulatory and data checks |
| `implementer` | Implementer | Starts and completes assigned changes (checklist) |
| `exec` | Executive | Override stage for changes inside a freeze window |
| `admin` | System Admin | Users, departments, change types, workflows. **Not** a change approver |

**Screen access (`PERMS`)**, which the nav and the API both enforce:
```
requester:     dashboard, changes, new, calendar, flows
lineManager:   + approvals
deptHead:      + approvals, reports
changeManager: + approvals, reports, audit
cab:           dashboard, changes, approvals, calendar, flows, reports
risk:          cab's list + audit
implementer:   dashboard, changes, calendar, flows
exec:          dashboard, changes, approvals, calendar, flows, reports
admin:         dashboard, admin, audit, flows
```

### 3.2 Change types
IT / system · Process / policy · Product · Organisational / HR · Infrastructure / facilities · Vendor / third-party. **Emergency** is a checkbox in the wizard, not a type. Types are admin-editable (`active` flag).

### 3.3 Departments
Claims, Underwriting, Finance, IT, HR, Customer Service, Actuarial, Sales & Distribution, Compliance, Operations. Each department has a code, a head, a line manager and an `active` flag.

### 3.4 Risk scoring
`impact` (1 Minor, 2 Moderate, 3 Major) × `likelihood` (1 Unlikely, 2 Possible, 3 Likely) = **score**
- score ≤ 2 → **Low** · ≤ 4 → **Medium** · otherwise (6–9) → **High**
- If `emergency` is ticked, the tier is **Emergency** whatever the score.

Extra flags: `customerFacing`, `regulatory` (NIC implications), `personalData`.

### 3.5 Approval routes (workflows)
Default routes:
| Tier | Stages, in order |
|---|---|
| Low | lineManager |
| Medium | lineManager → deptHead → changeManager |
| High | lineManager → deptHead → risk → cab → changeManager |
| Emergency | changeManager → cab (ECAB). PIR required within 5 days |

A department can **override** any tier. Seed overrides:
- **IT**: Low `changeManager` · Medium `lineManager → changeManager → cab`
- **Underwriting**: High adds `exec` at the end
- **Finance**: Medium `lineManager → deptHead → risk → changeManager` · High adds `exec`

Route resolution: `workflows[dept]?.[tier] ?? workflows.default[tier]`.

### 3.6 Freeze windows
| Name | From | To |
|---|---|---|
| Month-end financial close | 2026-10-28 | 2026-11-02 |
| Month-end financial close | 2026-11-27 | 2026-12-02 |
| Year-end freeze | 2026-12-14 | 2027-01-04 |

If the planned date falls inside a freeze, the change is **not** an emergency, and the route has no `exec` stage yet, then **append `exec`** to the route.

### 3.7 Change status lifecycle
```
Draft ──submit──► Pending approval ──all stages approved──► Scheduled (has date) / Approved
   ▲                   │  │
   │                   │  └─reject──► Rejected (remaining stages → skipped)
   └──resubmit── Returned for rework ◄─return─┘

Scheduled/Approved ──start (implementer or CM)──► In progress
In progress ──all checklist items done──► Implemented
Implemented ──PIR by Change Manager──► Closed
```
Statuses: `Draft, Pending approval, Returned for rework, Approved, Scheduled, In progress, Implemented, Closed, Rejected`.

### 3.8 Approval step status
`waiting` (not started) · `pending` (their turn now; only one at a time) · `approved` · `rejected` · `returned` · `skipped`

### 3.9 Authorization principles. **Enforce these on the server, not only in the UI.**
1. **Least privilege**: role → screens, from the table above.
2. **Segregation of duties**: you can't approve a change **you raised**, even if you hold the pending role.
3. **Stage-bound**: only the role on the current `pending` step can decide.
4. **Comment required** to reject or return. Optional to approve.
5. Requesters list only their own changes.
6. Only the **assigned implementer** or the **Change Manager** can start the work or tick the checklist. Only the **Change Manager** completes the PIR.
7. **Audit everything**: sign-in, submit, decision, start, implement, PIR, every admin change, import and export. Record user, role, time, IP and reference.

### 3.10 Screens
Login · Dashboard (KPIs differ by role) · Change requests (search, status chips, dept/risk/type filters, sort, pagination, CSV export) · Change detail (tabs: Overview, Risk & impact with a 3×3 matrix, Approvals timeline, Implementation checklist, Post-review, Activity) · New request wizard (Classify → Describe → Risk & impact → Plan → Review) · My approvals · Change calendar (month view with freezes) · Process flows · Reports · Audit trail (filters, CSV export) · Administration (Departments, Users with CSV import, Change types, Workflows editor, Permissions matrix) · Notifications popover · Dark mode · 403 page · Mobile approvals view.

Wizard validation: Step 2 needs `title` and `summary`. Step 4 needs `rollback`. Step 5 needs the `attest` checkbox. The Review step shows the calculated tier, the route and any freeze warning **live**.

---

## 4. Where the code is today (`frontend/`)

| File | State | What to do |
|---|---|---|
| `src/app/(dashboard)/layout.tsx`, `AppSidebar`, `AppHeader` | ✅ Good shell | Keep. Make the nav role-aware (Phase 5). |
| `src/app/(dashboard)/dashboard/page.tsx`, `StatCard` | Started | Keep. Wire to the API later. |
| `src/app/(dashboard)/changes/page.tsx`, `ChangeList`, `ChangeCard` | Started | Keep the components. Switch to the new types. |
| `src/app/(dashboard)/changes/new/page.tsx`, `ChangeRequestWizard` | 2 of 4 steps done | **Rework to the prototype's 5 steps** (Phase 5). |
| `BasicInformationForm`, `RiskImpactForm` | Partly done | Reuse the layout. The fields change (see below). |
| `ImplementationForm.tsx`, `ReviewChange.tsx`, `approvals/page.tsx` | Empty files | Build them. |
| `src/types/change.ts`, `src/types/change-form.ts` | ❌ Don't match the prototype | **Replace** with types inferred from the shared Zod schemas. |
| `src/data/changes.ts` | Mock data | Delete once the API works. The prototype's `seedChanges()` becomes the Prisma seed. |
| `globals.css` | Default | Add MiLife tokens: navy `#1D2A4D`, teal `#0B7F82` / `#17B3B5`, font Manrope. Light and dark. |

**Field mismatches to fix:** the current form uses `priority` and `impactLevel` (Low/Med/High). The prototype uses **numeric `impact` × `likelihood`**, from which the tier is *calculated*. There is no separate priority field. It also adds `emergency`, `reason`, `systems[]`, `customerFacing`, `regulatory`, `personalData`, `plannedDate`, `window`, `implementerId`, `testPlan`, `rollbackPlan`, `attest` and `attachments`. `implementationPlan`, `riskDescription` and `mitigationPlan` are not in the prototype. Keep them only if the business wants them (see open questions).

---

## 5. Target repo layout

```
crms/
├─ package.json            ← npm workspaces: ["frontend", "backend", "packages/*"]
├─ HANDOFF.md              ← this file
├─ docs/prototype/         ← reference prototype (don't edit)
├─ packages/shared/        ← Zod schemas, enums, risk/route helpers. Used by FE and BE
│  └─ src/{enums.ts, risk.ts, schemas/*.ts, index.ts}
├─ backend/
│  ├─ prisma/{schema.prisma, seed.ts, migrations/}
│  ├─ prisma.config.ts
│  ├─ src/
│  │  ├─ index.ts           ← starts the server
│  │  ├─ app.ts             ← express app, middleware, routes
│  │  ├─ lib/prisma.ts      ← single PrismaClient
│  │  ├─ middleware/{auth.ts, requirePerm.ts, validate.ts, error.ts}
│  │  ├─ modules/<feature>/{routes.ts, service.ts}   ← auth, changes, approvals, users, departments, types, workflows, audit, reports
│  │  └─ services/{routing.ts, audit.ts}
│  └─ .env                  ← DATABASE_URL, JWT_SECRET, CORS_ORIGIN (git-ignored)
└─ frontend/               ← existing Next app
   └─ src/lib/api.ts        ← fetch wrapper (credentials: "include")
```

**Why a `shared` package?** Rules like "score ≤ 2 is Low" or "title is required" should be written **once**. The wizard shows the live tier with `calcRisk()` from `shared`, and the server recalculates it with the same function. **Never trust the tier the client sends.**

**Feature folders (`modules/changes/…`):** `routes.ts` handles HTTP only (parse, validate, respond). `service.ts` holds the business logic and the Prisma calls. That keeps the rules testable without HTTP.

---

## 6. Data model (Prisma draft)

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
datasource db { provider = "mysql" }   // URL comes from prisma.config.ts

enum Role { requester lineManager deptHead changeManager cab risk implementer exec admin }
enum UserStatus { Active Invited Disabled }
enum RiskTier { Low Medium High Emergency }
enum ChangeStatus { Draft PendingApproval ReturnedForRework Approved Scheduled InProgress Implemented Closed Rejected }
enum StepStatus { waiting pending approved rejected returned skipped }
enum PirOutcome { Successful SuccessfulWithIssues Failed RolledBack }

model User {
  id           String     @id @default(cuid())
  code         String     @unique            // USR-0201
  name         String
  email        String     @unique
  passwordHash String?
  title        String?
  role         Role
  status       UserStatus @default(Invited)
  departmentId String
  department   Department @relation(fields: [departmentId], references: [id])
  lastLoginAt  DateTime?
  createdAt    DateTime   @default(now())
  requested    Change[]   @relation("requester")
  implementing Change[]   @relation("implementer")
}

model Department {
  id            String  @id @default(cuid())
  code          String  @unique              // CLM
  name          String  @unique
  headId        String?
  lineManagerId String?
  active        Boolean @default(true)
  users         User[]
  changes       Change[]
  workflows     WorkflowStage[]
}

model ChangeType {
  id          String  @id @default(cuid())
  label       String  @unique
  description String
  active      Boolean @default(true)
  changes     Change[]
}

/// One row per stage. departmentId = null means the company default route.
model WorkflowStage {
  id           String      @id @default(cuid())
  departmentId String?
  department   Department? @relation(fields: [departmentId], references: [id])
  tier         RiskTier
  order        Int
  role         Role
  @@unique([departmentId, tier, order])
}

model FreezeWindow {
  id   String   @id @default(cuid())
  name String
  from DateTime @db.Date
  to   DateTime @db.Date
}

model Change {
  id             String       @id @default(cuid())
  ref            String       @unique     // CHG-2026-0144
  title          String
  summary        String       @db.Text
  reason         String       @db.Text
  typeId         String
  type           ChangeType   @relation(fields: [typeId], references: [id])
  departmentId   String
  department     Department   @relation(fields: [departmentId], references: [id])
  emergency      Boolean      @default(false)
  impact         Int          // 1..3
  likelihood     Int          // 1..3
  tier           RiskTier     // stored at submit time, calculated by the server
  customerFacing Boolean      @default(false)
  regulatory     Boolean      @default(false)
  personalData   Boolean      @default(false)
  systems        Json         // string[]
  plannedDate    DateTime?    @db.Date
  window         String?
  testPlan       String?      @db.Text
  rollbackPlan   String?      @db.Text
  status         ChangeStatus @default(Draft)
  requesterId    String
  requester      User         @relation("requester", fields: [requesterId], references: [id])
  implementerId  String?
  implementer    User?        @relation("implementer", fields: [implementerId], references: [id])
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  submittedAt    DateTime?
  steps          ApprovalStep[]
  tasks          ChecklistTask[]
  attachments    Attachment[]
  pir            PostImplementationReview?
}

model ApprovalStep {
  id         String     @id @default(cuid())
  changeId   String
  change     Change     @relation(fields: [changeId], references: [id], onDelete: Cascade)
  order      Int
  role       Role
  status     StepStatus @default(waiting)
  decidedById String?
  decidedAt  DateTime?
  comment    String?    @db.Text
  @@unique([changeId, order])
}

model ChecklistTask {
  id       String  @id @default(cuid())
  changeId String
  change   Change  @relation(fields: [changeId], references: [id], onDelete: Cascade)
  order    Int
  label    String
  done     Boolean @default(false)
  doneAt   DateTime?
  doneById String?
}

model Attachment {
  id         String @id @default(cuid())
  changeId   String
  change     Change @relation(fields: [changeId], references: [id], onDelete: Cascade)
  fileName   String
  sizeBytes  Int
  storageKey String
  uploadedAt DateTime @default(now())
}

model PostImplementationReview {
  id         String     @id @default(cuid())
  changeId   String     @unique
  change     Change     @relation(fields: [changeId], references: [id], onDelete: Cascade)
  outcome    PirOutcome
  notes      String     @db.Text
  reviewedById String
  reviewedAt DateTime   @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  at        DateTime @default(now())
  userId    String?
  userName  String
  role      Role?
  action    String
  category  String   // signin | change | decision | config | export
  ref       String?  // CHG-…, USR-…, WF-…
  ip        String?
  meta      Json?
  @@index([ref])
  @@index([at])
}
```

**Key design choices, explained:**
- **The route is copied into `ApprovalStep` rows at submit time.** If an admin edits a workflow later, changes already in flight are not affected.
- **`tier` is stored** for fast filtering, but it is always **calculated by the server**.
- **`AuditLog.userName` is denormalised**, so the trail still reads correctly after a user is renamed or disabled.
- The ChangeStatus enum names differ from the display labels (`PendingApproval` vs "Pending approval"). Map them in `shared/enums.ts`.

`prisma.config.ts` + client:
```ts
// backend/prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations", seed: "tsx prisma/seed.ts" },
  datasource: { url: env("DATABASE_URL") },
});

// backend/src/lib/prisma.ts
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client";
const adapter = new PrismaMariaDb(process.env.DATABASE_URL!);
export const prisma = new PrismaClient({ adapter });
```
*(Check this against the installed Prisma version's docs before you run it. The config API has changed across releases.)*

---

## 7. API (Express, JSON, prefix `/api`)

Auth: **email + password → JWT in an httpOnly cookie** (`bcrypt` hashes). Every route except `/auth/login` runs `auth` middleware → `req.user = { id, role, departmentId, name }`. SSO/MFA come later (see open questions).

| Method & path | Who | Notes |
|---|---|---|
| `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` | all | audit sign-in |
| `GET /changes?q&status&dept&risk&type&sort&page&pageSize` | `changes` perm | requester → own only |
| `GET /changes/export.csv` | `changes` | audit export |
| `GET /changes/:ref` | `changes` | includes steps, tasks, PIR, attachments, activity |
| `POST /changes` | `new` | body = `changeCreateSchema`, `status: Draft \| submit` |
| `PATCH /changes/:ref` | requester, while Draft/Returned | |
| `POST /changes/:ref/submit` | requester | builds the route (dept + tier + freeze) → steps; first step `pending` |
| `POST /changes/:ref/decision` | current stage role | `{ kind: approve\|reject\|return, comment }`. SoD and stage checks |
| `POST /changes/:ref/start` | implementer/CM | Scheduled/Approved → In progress |
| `PATCH /changes/:ref/tasks/:taskId` | implementer/CM, In progress | toggle done |
| `POST /changes/:ref/implemented` | implementer/CM | all tasks must be done |
| `POST /changes/:ref/pir` | changeManager, Implemented | → Closed |
| `POST /changes/:ref/attachments` | requester | multipart (`multer`), local disk first |
| `GET /approvals/inbox` | approver roles | pending at my role, not raised by me |
| `GET /calendar?year&month` | `calendar` | changes + freezes |
| `GET /dashboard` | all | KPIs by role (see prototype `renderVals`) |
| `GET /reports/*` | `reports` | |
| `GET /audit?q&role&category&page` · `GET /audit/export.csv` | `audit` | |
| `GET/POST/PATCH /admin/departments` | admin | audit config |
| `GET/POST/PATCH /admin/users` · `POST /admin/users/import` (CSV) | admin | invite, disable, change role. Admin can't demote themselves |
| `GET/POST/PATCH /admin/change-types` | admin | |
| `GET/PUT /admin/workflows/:dept/:tier` | admin | replace the stage list |
| `GET /meta` | all | departments, types, implementers, freezes (for dropdowns) |

**Middleware chain:** `auth` → `requirePerm("changes")` → `validate({ body: schema })` → handler → central `error` handler (Zod errors → 400 with field messages, `AppError` → its own status).

**Decision logic, in one transaction:**
```
step = steps.find(pending); assert step.role === user.role; assert change.requesterId !== user.id
approve → step.approved; next waiting → pending; if none → status = plannedDate ? Scheduled : Approved
reject  → step.rejected; all waiting → skipped; status = Rejected     (comment required)
return  → step.returned; status = ReturnedForRework                   (comment required)
write AuditLog "Approved at <Stage> stage"
```
On resubmit after rework, rebuild the steps from the current route.

---

## 8. Shared Zod schemas (examples)

```ts
// packages/shared/src/risk.ts
export const calcRisk = (impact: number, likelihood: number) => {
  const score = impact * likelihood;
  return { score, risk: score <= 2 ? "Low" : score <= 4 ? "Medium" : "High" } as const;
};

// packages/shared/src/schemas/change.ts
import { z } from "zod";
export const changeCreateSchema = z.object({
  typeId: z.string().min(1),
  departmentId: z.string().min(1),
  emergency: z.boolean().default(false),
  title: z.string().trim().min(1, "Title is required").max(200),
  summary: z.string().trim().min(1, "Summary is required"),
  reason: z.string().trim().optional().default(""),
  systems: z.array(z.string().trim().min(1)).default([]),
  impact: z.number().int().min(1).max(3),
  likelihood: z.number().int().min(1).max(3),
  customerFacing: z.boolean(), regulatory: z.boolean(), personalData: z.boolean(),
  plannedDate: z.iso.date().optional(),
  window: z.string().optional(),
  implementerId: z.string().optional(),
  testPlan: z.string().optional(),
  rollbackPlan: z.string().trim().min(1, "Rollback plan is required"),
  attest: z.literal(true, { error: "Please confirm the declaration" }),
});
export type ChangeCreateInput = z.infer<typeof changeCreateSchema>;

export const decisionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("approve"), comment: z.string().optional() }),
  z.object({ kind: z.enum(["reject", "return"]), comment: z.string().trim().min(1, "A comment is required") }),
]);
```
The wizard validates each step with `changeCreateSchema.pick({...})`.

---

## 9. Build plan, in phases

Each phase ends in something you can run. Agents: **finish a phase, show it working, explain it, then stop for review.**

### Phase 0: Repo foundation
- Root `package.json` with npm workspaces. Root `.gitignore` (node_modules, .env, generated, uploads). Commit the existing `frontend/`.
- Create `packages/shared` (TS, exports enums, `calcRisk` and schemas). Add Zod.
- **Done when:** `npm install` at the root works and the frontend can `import { calcRisk } from "@crms/shared"`. (No `transpilePackages` needed: per the Next 16 docs, Turbopack transpiles workspace packages automatically.)
- ✅ **Done (2026-11-05).** The shared package exports `enums.ts` (roles, statuses, `PERMS`, `can()`), `risk.ts` (`calcRisk`, `tierFor`), `routing.ts` (`DEFAULT_ROUTES`, `buildRoute`, `findFreeze`) and `schemas/change.ts` (`changeCreateSchema`, `wizardStepSchemas`, `changeDraftSchema`, `decisionSchema`). `frontend/package-lock.json` was replaced by the root lockfile.

### Phase 1: Backend skeleton
- `backend/` with Express 5, TS, `tsx watch` for dev, `cors` (credentials, `CORS_ORIGIN=http://localhost:3000`), `helmet`, `cookie-parser`, the error handler, and `GET /api/health`.
- **Done when:** `npm run dev -w backend` serves `{ ok: true }` on :4000.

### Phase 2: Database
- Local MySQL 8 (Docker `docker-compose.yml` or a local install). Database `crms`.
- Prisma schema (section 6), first migration, **seed** that ports the prototype's `seedChanges`, `histChanges`, `seedUsers`, departments, types, `seedWF` and freezes. Seed password: `demo-password` for every user (dev only).
- **Done when:** `npx prisma migrate dev` + `npx prisma db seed` work and Prisma Studio shows about 40 changes and 37 users.

### Phase 3: Auth and permissions
- Login, logout and me. JWT cookie. `auth` + `requirePerm` middleware. `PERMS` map lives in `shared`. Audit on sign-in.
- **Done when:** logging in as each seeded role returns the right user, and a forbidden route returns 403.

### Phase 4: Core change API
- Changes list/detail/create/update/submit, the routing service (dept override → default → freeze `exec`), decisions (SoD, stage-bound), start, tasks, implemented, PIR, inbox, audit writes.
- **Unit tests** (Vitest) for `routing.ts`, `calcRisk` and the decision rules. **These are the heart of the app.**
- **Done when:** the scenario "Requester submits Medium → LM approves → DH approves → CM approves → Scheduled → implementer starts → ticks all tasks → Implemented → CM PIR → Closed" passes as an integration test, and the requester can't approve their own change.

### Phase 5: Frontend wired to the API
1. Design tokens + Manrope + dark mode toggle in `globals.css` / root layout.
2. `src/lib/api.ts` + TanStack Query provider. Login page. Redirect to login when not authenticated (Next 16 `proxy`/middleware: check the docs).
3. Role-aware sidebar with an approvals badge. 403 screen.
4. Change requests list (filters, chips, pagination, CSV).
5. **Rebuild the wizard** to 5 steps with React Hook Form + Zod and a live tier/route preview (`GET /meta` + `calcRisk` + a route preview endpoint or a shared helper).
6. Change detail with its 6 tabs and the decision panel (approve / rework / reject).
7. My approvals, Dashboard KPIs by role.
- **Done when:** the Phase 4 scenario can be clicked through in the browser.

### Phase 6: Secondary screens
Calendar (month grid + freezes), Process flows, Reports, Audit trail (+ export), Administration (departments, users + CSV import, change types, workflow editor, permissions matrix), notifications, mobile approvals layout.

### Phase 7: Hardening
Rate-limit login, attachments storage (local → S3/Blob later), email notifications on stage change, pagination indexes, E2E test (Playwright), deployment notes.

---

## 10. Conventions
- TypeScript `strict`. No `any`. Infer types from Zod (`z.infer`) instead of writing them twice.
- One PrismaClient instance (`lib/prisma.ts`).
- Every state-changing service call writes an `AuditLog` row **in the same transaction**.
- The server is the authority. The UI hides buttons for convenience, but the API enforces every rule in section 3.9.
- Commit small, one feature per commit, with a clear message.
- Don't edit `docs/prototype/`.

## 11. Open questions for the project owner
1. **Auth:** keep email/password for v1, or go straight to SSO (Microsoft Entra ID?) + MFA? The deck lists "identity integration" as a next step.
2. **Approver scoping:** must the Line Manager/Dept Head be from the **change's department**? The prototype only checks the role. Recommend: yes, scope by department for `lineManager` and `deptHead`.
3. Keep the current form's extra fields (`implementationPlan`, `riskDescription`, `mitigationPlan`)?
4. Attachments: where should files be stored in production?
5. Email/Teams notifications in v1?
6. Hosting target (on-prem vs cloud) and MySQL version available.
7. Change reference numbering: `CHG-<year>-<4 digits>`, resetting each year?
