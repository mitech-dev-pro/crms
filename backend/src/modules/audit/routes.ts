import { ROLE_LABELS, auditQuerySchema, type AuditListResponse, type AuditQuery } from "@crms/shared";
import { Router } from "express";
import type { Prisma } from "../../generated/prisma/client";
import { datedName, sendCsv } from "../../lib/csv";
import { prisma } from "../../lib/db";
import { requireAuth, requirePerm } from "../../middleware/auth";
import { writeAudit } from "../../services/audit";

export const auditRouter = Router();
auditRouter.use(requireAuth, requirePerm("audit"));

/** Filters shared by the list and the CSV export. */
function whereFor({ q, role, category, from, to }: Pick<AuditQuery, "q" | "role" | "category" | "from" | "to">): Prisma.AuditLogWhereInput {
  return {
    ...((from || to) && {
      at: {
        ...(from && { gte: new Date(`${from}T00:00:00Z`) }),
        // "to" is a whole day: everything before the next midnight.
        ...(to && { lt: new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000) }),
      },
    }),
    ...(role && { role }),
    ...(category && { category }),
    ...(q && { OR: [{ action: { contains: q } }, { userName: { contains: q } }, { ref: { contains: q } }] }),
  };
}

const select = { id: true, at: true, userName: true, role: true, action: true, category: true, ref: true, ip: true } as const;

// GET /api/audit?page=1&pageSize=10&q=&role=&category=&from=&to= — newest first.
auditRouter.get("/", async (req, res) => {
  // Express 5's req.query is read-only, so parse it into a new variable.
  const query = auditQuerySchema.parse(req.query);
  const where = whereFor(query);

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { at: "desc" }, skip: (query.page - 1) * query.pageSize, take: query.pageSize, select }),
    prisma.auditLog.count({ where }),
  ]);

  const body: AuditListResponse = {
    items: items.map((i) => ({ ...i, at: i.at.toISOString(), category: i.category as AuditListResponse["items"][number]["category"] })),
    total, page: query.page, pageSize: query.pageSize,
  };
  res.json(body);
});

// GET /api/audit/export.csv — same filters, up to 10,000 rows. Exporting is itself audited.
auditRouter.get("/export.csv", async (req, res) => {
  const { page: _p, pageSize: _s, ...filters } = auditQuerySchema.parse(req.query);
  const rows = await prisma.auditLog.findMany({ where: whereFor(filters), orderBy: { at: "desc" }, take: 10_000, select });
  await writeAudit({ action: "Exported audit trail (CSV)", category: "export", user: req.user!, ip: req.ip, meta: { rows: rows.length, filters } });

  sendCsv(res, datedName("audit-trail"), [
    ["Time (UTC)", "User", "Role", "Action", "Category", "Reference", "IP address"],
    ...rows.map((r) => [r.at.toISOString(), r.userName, r.role ? ROLE_LABELS[r.role] : "", r.action, r.category, r.ref ?? "", r.ip ?? ""]),
  ]);
});
