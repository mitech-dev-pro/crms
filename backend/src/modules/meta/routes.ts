import { Router } from "express";
import { prisma } from "../../lib/db";
import { requireAuth } from "../../middleware/auth";

export const metaRouter = Router();

// GET /api/meta — lookup lists for forms and filters. Any signed-in user.
metaRouter.get("/", requireAuth, async (_req, res) => {
  const [departments, changeTypes, implementers, freezes] = await Promise.all([
    prisma.department.findMany({ where: { active: true }, select: { id: true, code: true, name: true }, orderBy: { name: "asc" } }),
    prisma.changeType.findMany({ where: { active: true }, select: { id: true, label: true, description: true }, orderBy: { label: "asc" } }),
    prisma.user.findMany({ where: { role: "implementer", status: "Active" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.freezeWindow.findMany({ select: { name: true, from: true, to: true }, orderBy: { from: "asc" } }),
  ]);
  res.json({
    departments,
    changeTypes,
    implementers,
    // DATE columns → "YYYY-MM-DD", the format the shared routing helpers expect.
    freezes: freezes.map((f) => ({ name: f.name, from: f.from.toISOString().slice(0, 10), to: f.to.toISOString().slice(0, 10) })),
  });
});
