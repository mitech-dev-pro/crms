import {
  MAX_ATTACHMENT_BYTES, MAX_FILES_PER_UPLOAD, changeCreateSchema, commentSchema, changeDraftSchema, changeListQuerySchema, changeUpdateSchema, decisionSchema,
  pirSchema, routePreviewQuerySchema, submitSchema, taskUpdateSchema,
} from "@crms/shared";
import { Router, type Request } from "express";
import { datedName, sendCsv } from "../../lib/csv";
import { contentDisposition, uploadMiddleware } from "../../lib/uploads";
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

// Same filters as the list, as a CSV download. Before "/:ref" like route-preview.
changesRouter.get("/export.csv", requirePerm("changes"), async (req, res) => {
  const { page: _p, pageSize: _s, ...filters } = changeListQuerySchema.parse(req.query);
  sendCsv(res, datedName("changes"), await changes.exportChanges(actor(req), filters));
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

// POST /api/changes/:ref/comments { body } — the discussion on a change.
changesRouter.post("/:ref/comments", requirePerm("changes"), async (req, res) => {
  res.status(201).json(await changes.addComment(actor(req), ref(req), commentSchema.parse(req.body)));
});

// Attachments ----------------------------------------------------------------

// POST /api/changes/:ref/attachments — multipart/form-data, field "files" (up to 5 per request).
changesRouter.post("/:ref/attachments", requirePerm("changes"), uploadMiddleware(MAX_FILES_PER_UPLOAD, MAX_ATTACHMENT_BYTES), async (req, res) => {
  res.status(201).json(await changes.addAttachments(actor(req), ref(req), (req.files as changes.UploadedFile[] | undefined) ?? []));
});

// GET /api/changes/:ref/attachments/:id — always downloaded, never rendered in the browser.
changesRouter.get("/:ref/attachments/:id", requirePerm("changes"), async (req, res) => {
  const file = await changes.getAttachment(actor(req), ref(req), String(req.params.id));
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", contentDisposition(file.fileName));
  res.setHeader("Cache-Control", "private, no-store");
  res.send(file.data);
});

changesRouter.delete("/:ref/attachments/:id", requirePerm("changes"), async (req, res) => {
  res.json(await changes.removeAttachment(actor(req), ref(req), String(req.params.id)));
});
