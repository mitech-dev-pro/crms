# Deploying MiLife ChangeHub

How to run the app on a server for real use. For local development, see `HANDOFF.md`.

## 1. How the pieces fit

```
Browser ──HTTPS──► reverse proxy (IIS / nginx)
                      │
                      ▼
              Next.js  (frontend, port 3000)
                      │  /api/* is forwarded (rewrite) to:
                      ▼
              Express  (backend, port 4000, internal only)
                      │                 │
                      ▼                 ▼
                MySQL 8           backend/uploads/  (attachments)
```

- Only the **frontend** is exposed to users. Keep port 4000 closed to the network: the browser never calls it directly, and Next forwards `/api` to it on the same machine.
- Both apps run on **Node.js 24 LTS**. One server is enough to start with.

## 2. Prerequisites

| Item | Notes |
|---|---|
| Node.js 24 LTS + npm | Same major version as development. |
| MySQL 8.0+ | An empty database, e.g. `changehub`. Use one DB user for migrations (needs CREATE/ALTER) and, ideally, a separate app user with only SELECT/INSERT/UPDATE/DELETE. |
| HTTPS certificate | **Required.** In production the session cookie is `Secure`, so sign-in only works over HTTPS. |
| Reverse proxy | IIS (with URL Rewrite + ARR) or nginx, terminating HTTPS and forwarding to `http://127.0.0.1:3000`. |
| Process manager | Keeps both apps running and restarts them: a Windows service (e.g. NSSM), PM2 or systemd. |

## 3. Configuration

### `backend/.env` (copy from `backend/.env.example`)

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` (turns on Secure cookies, hides error details, disables the seed script) |
| `PORT` | `4000` |
| `DATABASE_URL` | `mysql://USER:PASSWORD@db-host:3306/changehub` (URL-encode special characters in the password) |
| `JWT_SECRET` | A long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. **Changing it signs everyone out.** |
| `SESSION_HOURS` | `8` (how long a sign-in lasts) |
| `CORS_ORIGIN` | The public site address, e.g. `https://changehub.milifeghana.com` |
| `TRUST_PROXY` | `loopback` if Next is on the same server. Add your reverse proxy's IP if it forwards from another machine (e.g. `loopback, 10.0.0.5`), so the audit trail records real client addresses. |
| `UPLOAD_DIR` | Attachment folder, default `uploads` (inside `backend/`). Use an absolute path on a backed-up disk if you prefer. |
| `LOGIN_MAX_FAILURES` / `LOGIN_MAX_PER_IP` | Login rate limits per 15 min (defaults 10 / 100). If many staff share one public IP behind NAT, raise `LOGIN_MAX_PER_IP`. |

### Frontend

| Variable | Value |
|---|---|
| `API_URL` | Where Next forwards `/api`: `http://127.0.0.1:4000`. **Needed at build time** (the rewrite is baked into the build), so set it before `npm run build`. |

## 4. First installation

```bash
git clone <repo> changehub && cd changehub
npm ci                                   # installs all workspaces from the lockfile
npm run db:generate -w @crms/backend     # generates the Prisma client (not committed)
npm run db:deploy -w @crms/backend       # creates/updates the tables (never use db:migrate or db:seed in production)
npm run db:bootstrap -w @crms/backend -- --email it.admin@milifeghana.com --name "IT Admin"
```

`db:bootstrap` creates only reference data: the change types, the default approval routes, one department (`IT`) and **one Super Admin**. It prints the Super Admin's temporary password **once**, and they must change it at first sign-in. Running it again is harmless. Then sign in and use **Administration** to add departments, users (or a CSV import), and any department-specific routes.

> ⚠️ `npm run db:seed` loads the demo data with a known password and **wipes the database**. It refuses to run when `NODE_ENV=production`.

Build and start:

```bash
API_URL=http://127.0.0.1:4000 npm run build -w frontend
npm start -w @crms/backend                      # API on :4000 (runs the TypeScript directly with tsx)
npm run start -w frontend -- -p 3000           # web on :3000
```

Register both start commands with your process manager, with the working directory set to the repo root.

## 5. Reverse proxy

Forward everything for the site to `http://127.0.0.1:3000` and keep the `Host` header. Also:
- redirect HTTP → HTTPS;
- set `client_max_body_size 55m` (nginx) or `maxAllowedContentLength` (IIS), since uploads can be 5 × 10 MB;
- add `X-Forwarded-For` / `X-Forwarded-Proto` (nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`).

## 6. Health checks and monitoring

| Endpoint | Meaning |
|---|---|
| `GET /api/health` | The API process is up (no database check). |
| `GET /api/health/ready` | The API **and the database** are working; `503` if MySQL is unreachable. Point uptime monitors and load balancers here. |

Logs: both processes write to stdout/stderr, so let the process manager capture and rotate them. Every sign-in, decision, configuration change and export is also in the in-app **Audit trail** (exportable as CSV).

## 7. Backups

Back up **both** together, at least daily:
1. the database: `mysqldump --single-transaction changehub > changehub-YYYYMMDD.sql`;
2. the attachments folder (`UPLOAD_DIR`). The database only stores file names; the files live on disk.

Test a restore on a spare machine now and then.

## 8. Upgrading to a new version

```bash
git pull
npm ci
npm run db:generate -w @crms/backend
npm run db:deploy -w @crms/backend        # applies any new migrations; safe to run when there are none
API_URL=http://127.0.0.1:4000 npm run build -w frontend
# restart both services
```

Take a database backup before upgrading.

## 9. Security checklist

- [ ] HTTPS only; `NODE_ENV=production`; port 4000 not reachable from the network.
- [ ] A unique, random `JWT_SECRET`, kept out of git (`.env` is git-ignored).
- [ ] The app's DB user can't drop or alter tables (use a separate user for `db:deploy`).
- [ ] No demo data: never run `db:seed`; create real users via Administration.
- [ ] The first Super Admin changed their temporary password; at least two people hold the Change Manager role (so a requester who is the only holder isn't blocked; see the override rules in HANDOFF.md).
- [ ] Backups of the database **and** uploads, with a tested restore.

## 10. Known limitations (current version)

- **Single API instance:** login rate-limit counters are in memory. Running several API servers needs a shared store (e.g. Redis) for them.
- **Attachments on local disk**, without virus scanning. For larger deployments, move them to object storage and add scanning.
- **No email or SMS notifications.** People see what needs them in the app (the bell and My approvals).
- **Sign-in is email + password.** Single sign-on (e.g. Microsoft Entra ID) and MFA are not built yet.
