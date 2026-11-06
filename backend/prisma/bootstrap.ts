// First-time setup for a REAL (empty) database — the production counterpart of seed.ts.
// Creates only reference data and one Super Admin; everything else is done in the app
// (Administration). Safe to re-run: existing rows are left alone.
//
//   npm run db:bootstrap -w @crms/backend -- --email it.admin@milife.com.gh --name "IT Admin"
//   options: --dept-code IT --dept-name "IT"
import "dotenv/config";
import { DEFAULT_ROUTES, RISK_TIERS } from "@crms/shared";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { createPrisma } from "../src/lib/prisma";
import { CHANGE_TYPES } from "./seed-data";

const { values: args } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    "dept-code": { type: "string", default: "IT" },
    "dept-name": { type: "string", default: "IT" },
  },
});
if (!args.email || !args.name) {
  console.error('Usage: npm run db:bootstrap -w @crms/backend -- --email you@milife.com.gh --name "Your Name" [--dept-code IT --dept-name IT]');
  process.exit(1);
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
const prisma = createPrisma(process.env.DATABASE_URL);

async function main() {
  // Change types (same list as the prototype; edit later in Administration).
  for (const [label, description] of CHANGE_TYPES) {
    await prisma.changeType.upsert({ where: { label }, update: {}, create: { label, description } });
  }

  // Company default approval routes, unless they already exist.
  if ((await prisma.workflowStage.count({ where: { departmentId: null } })) === 0) {
    await prisma.workflowStage.createMany({
      data: RISK_TIERS.flatMap((tier) => DEFAULT_ROUTES[tier].map((role, order) => ({ departmentId: null, tier, order, role }))),
    });
    console.log("✔ Default approval routes created");
  }

  // One department for the first admin to belong to.
  const dept = await prisma.department.upsert({
    where: { code: args["dept-code"]!.toUpperCase() },
    update: {},
    create: { code: args["dept-code"]!.toUpperCase(), name: args["dept-name"]! },
  });

  // The first Super Admin, with a one-time password they must change at first sign-in.
  const email = args.email!.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) {
    console.log(`✔ ${email} already exists. Nothing changed. (Use Administration → Users → Reset password if needed.)`);
    return;
  }
  const temporaryPassword = randomBytes(9).toString("base64url");
  const last = await prisma.user.findFirst({ where: { code: { startsWith: "USR-" } }, orderBy: { code: "desc" }, select: { code: true } });
  await prisma.user.create({
    data: {
      code: `USR-${String((last ? Number(last.code.slice(4)) : 200) + 1).padStart(4, "0")}`,
      name: args.name!.trim(),
      email,
      role: "superAdmin",
      status: "Active",
      departmentId: dept.id,
      passwordHash: await bcrypt.hash(temporaryPassword, 10),
      mustChangePassword: true,
    },
  });
  await prisma.auditLog.create({ data: { userName: "bootstrap script", action: `Created first super admin ${email}`, category: "config" } });

  console.log(`\n✔ Super Admin created: ${email}`);
  console.log(`  Temporary password (shown once, change it at first sign-in): ${temporaryPassword}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
