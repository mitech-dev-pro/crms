# MiLife ChangeHub

Change management for MiLife Insurance Ghana. Staff raise a change request. It goes through an approval route based on its risk, gets scheduled and implemented, and is reviewed afterwards. Every step is recorded in an audit trail.

## Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Everyday commands](#everyday-commands)
- [Testing](#testing)
- [Email in development](#email-in-development)
- [Key rules](#key-rules)
- [Documentation](#documentation)

## What it does

- **Raise a change** in a five-step wizard: classify it, describe it, assess risk (impact × likelihood), plan it, then review and submit. Drafts save at any point. You can attach files or copy an existing change.
- **Approval routes** per risk tier and department: Line Manager, Department Head, Risk & Compliance, CAB and Change Manager, plus an Executive stage for changes inside a freeze window.
- **My approvals:** each approver sees what's waiting at their stage and when it's due. They approve, reject (with a reason) or return it for rework.
- **Reminders and escalation:** a stage waiting 2 working days gets a reminder; after 4, the Change Managers are alerted.
- **Stand-ins:** approvers on leave name someone to decide on their behalf for a set period.
- **Implementation and review:** the implementer works through a checklist; the Change Manager records a post-implementation review.
- **Discussion:** comments on each change, with email to everyone involved.
- **Change calendar** with freeze windows, **process flows**, **reports** (with date ranges and CSV export) and a full **audit trail**.
- **Administration:** departments, change types, approval workflows, users (invite, CSV import, roles, temporary passwords) and stand-ins.
- **Security:**
  - role-based access, enforced on the server;
  - segregation of duties: nobody approves their own change;
  - login rate limits and sessions that can be revoked;
  - forced change of temporary passwords and self-service password reset.
- **Interface:** light and dark mode, works on phones, Ctrl+K quick jump, and automated accessibility checks.

## Tech stack

| Part | Technology |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, TanStack Query, React Hook Form |
| Backend | Express 5, TypeScript, Zod 4 |
| Database | MySQL 8 with Prisma 7 |
| Shared | `@crms/shared`: Zod schemas, types and business rules used by both the frontend and the backend |
| Email | Nodemailer (SMTP, or an on-disk outbox in development) |
| Tests | Vitest + Supertest (API), Playwright + axe-core (browser and accessibility) |

The browser only ever talks to Next.js. Next forwards `/api/*` to Express, so the session cookie stays first-party.

## Repository layout

```
crms/
├── frontend/          Next.js app (pages in src/app, components in src/components)
├── backend/           Express API
│   ├── prisma/        schema, migrations, seed and bootstrap scripts
│   ├── src/modules/   one folder per feature: auth, changes, approvals, admin, stand-ins, …
│   ├── src/services/  email, notifications, reminders, audit, routing
│   └── test/          API tests (run against a separate changehub_test database)
├── packages/shared/   schemas, types and rules shared by frontend and backend
├── e2e/               Playwright browser and accessibility tests
└── docs/              deployment guide, demo accounts, original prototype
```

It's an npm workspaces monorepo: one `npm install` at the root installs everything.

## Getting started

### Prerequisites

- **Node.js 22 or newer** (developed on Node 24)
- **MySQL 8** running locally
- **Google Chrome** (only for the browser tests)

### 1. Install

```bash
npm install
```

### 2. Create the database and configure the API

Create an empty MySQL database called `changehub`, then copy the example settings:

```bash
cp backend/.env.example backend/.env
```

In `backend/.env`, set `DATABASE_URL` to your MySQL user and password. Set `JWT_SECRET` to a long random string, which you can generate with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### 3. Create the tables and load demo data

```bash
npm run db:generate -w @crms/backend
```

```bash
npm run db:migrate -w @crms/backend
```

```bash
npm run db:seed -w @crms/backend
```

The seed creates 39 users, 10 departments and 39 sample changes. Every demo account uses the password `demo-password`. The full list is in [docs/DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md); for example, `ama.mensah@milifeghana.com` is a requester and `yaw.owusu@milifeghana.com` is the Change Manager.

### 4. Run it

Use two terminals:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

Open http://localhost:3000. The API runs on http://localhost:4000 (check it at `/api/health/ready`).

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run dev:frontend` | Next.js dev server on port 3000 |
| `npm run dev:backend` | API on port 4000, restarting on changes |
| `npm run test:backend` | API tests |
| `npm run test:e2e` | Browser and accessibility tests |
| `npm run typecheck:shared` | Type-check the shared package |
| `npm run lint -w frontend` | Lint the frontend |
| `npm run db:migrate -w @crms/backend` | Create and apply a migration after editing `schema.prisma` |
| `npm run db:generate -w @crms/backend` | Regenerate the Prisma client (needed after every schema change) |
| `npm run db:seed -w @crms/backend` | **Wipe** the dev database and reload demo data |
| `npm run db:studio -w @crms/backend` | Browse the database in Prisma Studio |

## Testing

- **API tests** (`npm run test:backend`): send real HTTP requests through the app, against a separate `changehub_test` database that is created, migrated and seeded on every run. Your dev data is never touched.
- **Browser tests** (`npm run test:e2e`): build the app and start their own API (port 4100) and web server (port 3100) against the test database. Playwright then clicks through real journeys in your installed Chrome: raising and approving a change, access control, the date picker, password reset by emailed link, the discussion, and copying a change.
- **Accessibility checks** run axe-core on every main screen in light and dark mode and fail on any WCAG 2.1 A/AA problem. Run `A11Y_DEBUG=1 npm run test:e2e` to print each failing element.

The browser tests take a few minutes because they build the frontend first. Stop your own dev servers if ports 3100 or 4100 are in use.

## Email in development

With `SMTP_HOST` left empty, no email is sent. Each message is written as an `.eml` file to `backend/.mail-outbox/`, which you can open in Outlook or Mail to see exactly what would go out. Set the `SMTP_*` settings to send for real; see the deployment guide.

## Key rules

These are enforced by the API, not just hidden in the UI:

- **Risk:** risk score = impact × likelihood. 1–2 is Low, 3–4 is Medium, 6–9 is High; Emergency changes have their own route.
- **Segregation of duties:** the requester can never approve their own change, even through a stand-in. The super admin has a break-glass override, which needs a reason and is flagged in the audit trail.
- **Comments on decisions:** rejecting or returning a change always needs a comment.
- **Freeze windows:** a non-emergency change dated inside a freeze gets an extra Executive approval stage.
- **Visibility:** requesters see only their own changes. Drafts are private until submitted.
- **Audit trail:** every sign-in, decision, configuration change and export is recorded.

## Documentation

| Document | What's in it |
| --- | --- |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production setup: configuration, email, first super admin (`db:bootstrap`), reverse proxy, backups, upgrades, security checklist |
| [docs/DEMO_ACCOUNTS.md](docs/DEMO_ACCOUNTS.md) | Every seeded account, by role and test case |
| [HANDOFF.md](HANDOFF.md) | The original build plan, domain rules, data model and open questions |
| [docs/prototype/](docs/prototype/) | The clickable prototype the app was built from |
