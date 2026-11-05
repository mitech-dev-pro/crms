import { auditQuerySchema } from "@crms/shared";
import { Router } from "express";
import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../../lib/db";
import { requireAuth, requirePerm } from "../../middleware/auth";

export const auditRouter = Router();

// GET /api/audit?page=1&pageSize=10&q=&role=&category= — newest first.
auditRouter.get("/", requireAuth, requirePerm("audit"), async (req, res) => {
  // Express 5's req.query is read-only, so parse it into a new variable.
  const { page, pageSize, q, role, category } = auditQuerySchema.parse(req.query);

  const where: Prisma.AuditLogWhereInput = {
    ...(role && { role }),
    ...(category && { category }),
    ...(q && { OR: [{ action: { contains: q } }, { userName: { contains: q } }, { ref: { contains: q } }] }),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: { id: true, at: true, userName: true, role: true, action: true, category: true, ref: true, ip: true },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ items, total, page, pageSize });
});
