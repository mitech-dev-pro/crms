// Calendar, freeze windows and the effective approval routes (process flows).
import {
  FREEZE_MANAGERS, RISK_TIERS, calendarQuerySchema, freezeSchema,
  type CalendarResponse, type FreezeDto, type RiskTier, type Role, type WorkflowsResponse,
} from "@crms/shared";
import { Router, type RequestHandler } from "express";
import { prisma } from "../../lib/db";
import { forbidden, notFound } from "../../lib/errors";
import { requireAuth, requirePerm } from "../../middleware/auth";
import { writeAudit } from "../../services/audit";
import { isoDate } from "../../services/routing";
import { listInclude, toListItem } from "../changes/dto";
import { visibleTo } from "../changes/service";

export const planningRouter = Router();
planningRouter.use(requireAuth);

const day = (iso: string) => new Date(iso + "T00:00:00Z");
const toFreeze = (f: { id: string; name: string; from: Date; to: Date }): FreezeDto => ({ id: f.id, name: f.name, from: isoDate(f.from), to: isoDate(f.to) });

// GET /api/calendar?from&to — changes planned in the visible range, plus overlapping freezes.
planningRouter.get("/calendar", requirePerm("calendar"), async (req, res) => {
  const { from, to } = calendarQuerySchema.parse(req.query);
  const [rows, freezes] = await Promise.all([
    prisma.change.findMany({
      where: {
        AND: [visibleTo({ ...req.user!, ip: req.ip }), { plannedDate: { gte: day(from), lte: day(to) } }, { status: { notIn: ["Draft", "Rejected"] } }],
      },
      orderBy: [{ plannedDate: "asc" }, { ref: "asc" }],
      include: listInclude,
    }),
    // A freeze overlaps the range if it starts before the range ends and ends after it starts.
    prisma.freezeWindow.findMany({ where: { from: { lte: day(to) }, to: { gte: day(from) } }, orderBy: { from: "asc" } }),
  ]);
  const body: CalendarResponse = { items: rows.map(toListItem), freezes: freezes.map(toFreeze) };
  res.json(body);
});

// GET /api/freezes — all freeze windows.
planningRouter.get("/freezes", async (_req, res) => {
  res.json({ items: (await prisma.freezeWindow.findMany({ orderBy: { from: "asc" } })).map(toFreeze) });
});

const requireFreezeManager: RequestHandler = (req, _res, next) => {
  if (!FREEZE_MANAGERS.includes(req.user!.role)) throw forbidden("Only the Change Manager can manage freeze windows");
  next();
};

// POST /api/freezes { name, from, to }
planningRouter.post("/freezes", requireFreezeManager, async (req, res) => {
  const input = freezeSchema.parse(req.body);
  const f = await prisma.$transaction(async (tx) => {
    const created = await tx.freezeWindow.create({ data: { name: input.name, from: day(input.from), to: day(input.to) } });
    await writeAudit({ action: `Added freeze window: ${input.name} (${input.from} – ${input.to})`, category: "config", user: req.user!, ip: req.ip }, tx);
    return created;
  });
  res.status(201).json(toFreeze(f));
});

// DELETE /api/freezes/:id
planningRouter.delete("/freezes/:id", requireFreezeManager, async (req, res) => {
  await prisma.$transaction(async (tx) => {
    const f = await tx.freezeWindow.findUnique({ where: { id: String(req.params.id) } });
    if (!f) throw notFound("Freeze window");
    await tx.freezeWindow.delete({ where: { id: f.id } });
    await writeAudit({ action: `Removed freeze window: ${f.name} (${isoDate(f.from)} – ${isoDate(f.to)})`, category: "config", user: req.user!, ip: req.ip }, tx);
  });
  res.status(204).end();
});

// GET /api/workflows — the company default route per tier plus department overrides.
// Read-only for everyone with the Process flows screen; admins edit them (Phase 6b).
planningRouter.get("/workflows", requirePerm("flows"), async (_req, res) => {
  const [departments, stages] = await Promise.all([
    prisma.department.findMany({ select: { id: true, code: true, name: true, active: true }, orderBy: { name: "asc" } }),
    prisma.workflowStage.findMany({ orderBy: [{ tier: "asc" }, { order: "asc" }] }),
  ]);
  const body: WorkflowsResponse = {
    departments,
    default: Object.fromEntries(RISK_TIERS.map((t) => [t, [] as Role[]])) as Record<RiskTier, Role[]>,
    overrides: {},
  };
  for (const s of stages) {
    if (s.departmentId === null) body.default[s.tier].push(s.role);
    else ((body.overrides[s.departmentId] ??= {})[s.tier] ??= []).push(s.role);
  }
  res.json(body);
});
