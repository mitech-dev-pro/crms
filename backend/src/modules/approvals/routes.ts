import { Router } from "express";
import { requireAuth, requirePerm } from "../../middleware/auth";
import { inbox } from "../changes/service";

export const approvalsRouter = Router();

// GET /api/approvals/inbox — changes waiting at my stage that I did not raise.
approvalsRouter.get("/inbox", requireAuth, requirePerm("approvals"), async (req, res) => {
  res.json({ items: await inbox({ ...req.user!, ip: req.ip }) });
});
