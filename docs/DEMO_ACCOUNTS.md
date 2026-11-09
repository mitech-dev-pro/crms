# Demo accounts (development and testing only)

`npm run db:seed -w @crms/backend` creates these users. They used to be one-click buttons on the
login screen; they now live here so the login screen looks the way it will in production.

- **Password for every seeded user:** `demo-password`
- **Email pattern:** first and last name, lower case, joined by a dot, at `@milifeghana.com`
- **Never in production.** `db:seed` refuses to run when `NODE_ENV=production`. A production
  database starts from `npm run db:bootstrap` instead (see [DEPLOYMENT.md](DEPLOYMENT.md)).
- The data itself is in [`backend/prisma/seed-data.ts`](../backend/prisma/seed-data.ts).
  Change it there; this page is just a quick reference.

## One account per role

| Role | Name | Email | Department |
| --- | --- | --- | --- |
| Requester | Ama Mensah | `ama.mensah@milifeghana.com` | Claims |
| Line Manager | Kwame Boateng | `kwame.boateng@milifeghana.com` | Claims |
| Department Head | Efua Asante | `efua.asante@milifeghana.com` | Claims |
| Change Manager | Yaw Owusu | `yaw.owusu@milifeghana.com` | IT |
| Deputy Change Manager | Deputy Change Manager | `deputy.change.manager@milifeghana.com` | IT |
| CAB Member | Akosua Darko | `akosua.darko@milifeghana.com` | Operations |
| Risk & Compliance | Nana Agyeman | `nana.agyeman@milifeghana.com` | Compliance |
| Implementer | Kojo Frimpong | `kojo.frimpong@milifeghana.com` | IT |
| Executive | Abena Osei | `abena.osei@milifeghana.com` | Operations |
| System Admin | Selorm Dzidzienyo | `selorm.dzidzienyo@milifeghana.com` | IT |
| Super Admin | Super Admin | `super.admin@milifeghana.com` | IT |

## Useful for testing particular cases

| What you want to test | Account |
| --- | --- |
| A second Line Manager (Finance) | `fiifi.sam@milifeghana.com` |
| A second Implementer | `michael.obeng@milifeghana.com` |
| A Department Head outside Claims (Underwriting) | `christiana.kyei@milifeghana.com` |
| An **Invited** user (can't sign in until activated) | `mudassiru.akanni@milifeghana.com` |
| A **Disabled** user (sign-in refused) | `kafui.philomena@milifeghana.com`, `esi.arthur@milifeghana.com` |

## Things to know

- **Segregation of duties:** a requester can never approve their own change. To see the approve
  buttons, sign in as someone other than the person who raised it.
- **Sign-in limits still apply:** 10 wrong passwords for one account from one address locks it out
  for 15 minutes.
- **Re-seeding wipes everything.** It rebuilds all demo data, including changes and users you added.
- **The browser tests** (`npm run test:e2e`) use these same accounts against the separate
  `changehub_test` database, so they never touch your dev data.
