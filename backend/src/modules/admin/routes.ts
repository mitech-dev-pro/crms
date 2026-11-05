import {
  changeTypeCreateSchema, changeTypeUpdateSchema, departmentCreateSchema, departmentUpdateSchema,
  userImportSchema, userInviteSchema, userListQuerySchema, userUpdateSchema, workflowUpdateSchema,
} from "@crms/shared";
import { Router, type Request } from "express";
import { datedName, sendCsv } from "../../lib/csv";
import { requireAuth, requirePerm } from "../../middleware/auth";
import * as admin from "./service";

// Everything under /api/admin needs the Administration screen (System Admin, Super Admin).
export const adminRouter = Router();
adminRouter.use(requireAuth, requirePerm("admin"));

const actor = (req: Request): admin.Actor => ({ ...req.user!, ip: req.ip });
const id = (req: Request) => String(req.params.id);

// Departments
adminRouter.get("/departments", async (_req, res) => res.json({ items: await admin.listDepartments() }));
adminRouter.post("/departments", async (req, res) => {
  await admin.createDepartment(actor(req), departmentCreateSchema.parse(req.body));
  res.status(201).json({ items: await admin.listDepartments() });
});
adminRouter.patch("/departments/:id", async (req, res) => {
  await admin.updateDepartment(actor(req), id(req), departmentUpdateSchema.parse(req.body));
  res.json({ items: await admin.listDepartments() });
});

// Change types
adminRouter.get("/change-types", async (_req, res) => res.json({ items: await admin.listChangeTypes() }));
adminRouter.post("/change-types", async (req, res) => {
  await admin.createChangeType(actor(req), changeTypeCreateSchema.parse(req.body));
  res.status(201).json({ items: await admin.listChangeTypes() });
});
adminRouter.patch("/change-types/:id", async (req, res) => {
  await admin.updateChangeType(actor(req), id(req), changeTypeUpdateSchema.parse(req.body));
  res.json({ items: await admin.listChangeTypes() });
});

// Users
adminRouter.get("/users", async (req, res) => res.json(await admin.listUsers(userListQuerySchema.parse(req.query))));
adminRouter.get("/users/export.csv", async (req, res) => {
  const { page: _p, pageSize: _s, ...filters } = userListQuerySchema.parse(req.query);
  sendCsv(res, datedName("users"), await admin.exportUsers(actor(req), filters));
});
adminRouter.post("/users", async (req, res) => res.status(201).json(await admin.inviteUser(actor(req), userInviteSchema.parse(req.body))));
adminRouter.post("/users/import", async (req, res) => {
  const { rows, dryRun } = userImportSchema.parse(req.body);
  res.json(await admin.importUsers(actor(req), rows, dryRun));
});
adminRouter.patch("/users/:id", async (req, res) => res.json(await admin.updateUser(actor(req), id(req), userUpdateSchema.parse(req.body))));
adminRouter.post("/users/:id/reset-password", async (req, res) => {
  // The temporary password is in this one response only; tell caches not to keep it.
  res.setHeader("Cache-Control", "no-store");
  res.json(await admin.resetPassword(actor(req), id(req)));
});

// Workflows (read via GET /api/workflows)
adminRouter.put("/workflows", async (req, res) => {
  await admin.updateWorkflow(actor(req), workflowUpdateSchema.parse(req.body));
  res.status(204).end();
});
