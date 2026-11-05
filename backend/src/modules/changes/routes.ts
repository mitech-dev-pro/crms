import {
  changeCreateSchema, changeDraftSchema, changeListQuerySchema, changeUpdateSchema, decisionSchema,
  pirSchema, routePreviewQuerySchema, submitSchema, taskUpdateSchema,
} from "@crms/shared";
import { Router, type Request } from "express";
import { requireAuth, requirePerm } from "../../middleware/auth";
import * as changes from "./service";

export const changesRouter = Router();
changesRouter.use(requireAuth); // every route below needs a signed-in user

const actor = (req: Request): changes.Actor => ({ ...req.user!, ip: req.ip });
const ref = (req: Request) => String(req.params.ref);

// Reads ---------------------------------------------------------------------

changesRouter.get("/", requirePerm("changes"), async (req, res) => {
  res.json(await changes.listChanges(actor(req), changeListQuerySchema.parse(req.query)));
});

// Must come before "/:ref", or Express would treat "route-preview" as a ref.
changesRouter.get("/route-preview", requirePerm("new"), async (req, res) => {
  res.json(await changes.routePreview(routePreviewQuerySchema.parse(req.query)));
});

changesRouter.get("/:ref", requirePerm("changes"), async (req, res) => {
  res.json(await changes.getChange(actor(req), ref(req)));
});

// Writes — each returns the updated change ------------------------------------

// Body: the wizard fields, plus "submit": true to send it for approval straight away.
// Drafts need only type and department; submitting needs everything (and attest: true).
changesRouter.post("/", requirePerm("new"), async (req, res) => {
  const submit = req.body?.submit === true;
  const data = submit ? changeCreateSchema.parse(req.body) : changeDraftSchema.parse(req.body);
  res.status(201).json(await changes.createChange(actor(req), data, submit));
});

changesRouter.patch("/:ref", requirePerm("changes"), async (req, res) => {
  res.json(await changes.updateChange(actor(req), ref(req), changeUpdateSchema.parse(req.body)));
});

changesRouter.post("/:ref/submit", requirePerm("changes"), async (req, res) => {
  submitSchema.parse(req.body);
  res.json(await changes.submitChange(actor(req), ref(req)));
});

changesRouter.post("/:ref/decision", requirePerm("approvals"), async (req, res) => {
  res.json(await changes.decideChange(actor(req), ref(req), decisionSchema.parse(req.body)));
});

changesRouter.post("/:ref/start", requirePerm("changes"), async (req, res) => {
  res.json(await changes.startChange(actor(req), ref(req)));
});

changesRouter.patch("/:ref/tasks/:taskId", requirePerm("changes"), async (req, res) => {
  const { done } = taskUpdateSchema.parse(req.body);
  res.json(await changes.setTask(actor(req), ref(req), String(req.params.taskId), done));
});

changesRouter.post("/:ref/implemented", requirePerm("changes"), async (req, res) => {
  res.json(await changes.markImplemented(actor(req), ref(req)));
});

changesRouter.post("/:ref/pir", requirePerm("changes"), async (req, res) => {
  res.json(await changes.reviewChange(actor(req), ref(req), pirSchema.parse(req.body)));
});
