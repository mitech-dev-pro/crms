# Demo accounts (development and testing only)

`npm run db:seed -w @crms/backend` creates these users. They used to be one-click buttons on the
login screen; they now live here so the login screen looks the way it will in production.

- **Password for every seeded user:** `demo-password`
- **Email pattern:** first and last name, lower case, joined by a dot, at `@milife.com.gh`
- **Never in production.** `db:seed` refuses to run when `NODE_ENV=production`. A production
  database starts from `npm run db:bootstrap` instead (see [DEPLOYMENT.md](DEPLOYMENT.md)).
- The data itself is in [`backend/prisma/seed-data.ts`](../backend/prisma/seed-data.ts).
  Change it there; this page is just a quick reference.

## One account per role

| Role | Name | Email | Department |
| --- | --- | --- | --- |
| Requester | Ama Mensah | `ama.mensah@milife.com.gh` | Claims |
| Line Manager | Kwame Boateng | `kwame.boateng@milife.com.gh` | Claims |
| Department Head | Efua Asante | `efua.asante@milife.com.gh` | Claims |
| Change Manager | Yaw Owusu | `yaw.owusu@milife.com.gh` | IT |
| Deputy Change Manager | Deputy Change Manager | `deputy.change.manager@milife.com.gh` | IT |
| CAB Member | Akosua Darko | `akosua.darko@milife.com.gh` | Operations |
| Risk & Compliance | Nana Agyeman | `nana.agyeman@milife.com.gh` | Compliance |
| Implementer | Kojo Frimpong | `kojo.frimpong@milife.com.gh` | IT |
| Executive | Abena Osei | `abena.osei@milife.com.gh` | Operations |
| System Admin | Selorm Dzidzienyo | `selorm.dzidzienyo@milife.com.gh` | IT |
| Super Admin | Super Admin | `super.admin@milife.com.gh` | IT |

## Useful for testing particular cases

| What you want to test | Account |
| --- | --- |
| A second Line Manager (Finance) | `fiifi.sam@milife.com.gh` |
| A second Implementer | `michael.obeng@milife.com.gh` |
| A Department Head outside Claims (Underwriting) | `christiana.kyei@milife.com.gh` |
| An **Invited** user (can't sign in until activated) | `mudassiru.akanni@milife.com.gh` |
| A **Disabled** user (sign-in refused) | `kafui.philomena@milife.com.gh`, `esi.arthur@milife.com.gh` |

## Things to know

- **Segregation of duties:** a requester can never approve their own change. To see the approve
  buttons, sign in as someone other than the person who raised it.
- **Sign-in limits still apply:** 10 wrong passwords for one account from one address locks it out
  for 15 minutes.
- **Re-seeding wipes everything.** It rebuilds all demo data, including changes and users you added.
- **The browser tests** (`npm run test:e2e`) use these same accounts against the separate
  `changehub_test` database, so they never touch your dev data.
