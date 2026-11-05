import { buildRoute, type RiskTier, type TierRoutes } from "@crms/shared";
import type { PrismaClient } from "../generated/prisma/client";

type Db = Pick<PrismaClient, "workflowStage" | "freezeWindow">;

/**
 * Loads workflows and freezes from the database, then lets the shared
 * buildRoute() decide the route. The wizard preview uses the same function,
 * so the route shown to the requester is exactly the one they'll get.
 */
export async function routeFor(db: Db, opts: { departmentId: string; tier: RiskTier; plannedDate?: string }) {
  const stagesFor = (departmentId: string | null) =>
    db.workflowStage.findMany({ where: { departmentId, tier: opts.tier }, orderBy: { order: "asc" }, select: { role: true } });

  const [deptStages, defaultStages, freezes] = await Promise.all([
    stagesFor(opts.departmentId),
    stagesFor(null), // departmentId = null rows are the company default, editable by admins
    db.freezeWindow.findMany({ select: { name: true, from: true, to: true } }),
  ]);

  // Department override first, then the database default. The shared DEFAULT_ROUTES
  // in buildRoute() is only a last resort if the workflow table is empty.
  const stages = deptStages.length ? deptStages : defaultStages;
  const deptOverride: Partial<TierRoutes> | undefined = stages.length
    ? { [opts.tier]: stages.map((s) => s.role) }
    : undefined;

  return buildRoute({
    tier: opts.tier,
    deptOverride,
    plannedDate: opts.plannedDate,
    freezes: freezes.map((f) => ({ name: f.name, from: isoDate(f.from), to: isoDate(f.to) })),
  });
}

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
