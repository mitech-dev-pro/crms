// Attachments: upload rules, who may add/remove/download, and file-system safety.
import { existsSync } from "node:fs";
import path from "node:path";
import type { Response } from "superagent";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db";
import { signIn, type Agent } from "./helpers";

let ama: Agent, kwame: Agent, yaw: Agent;
let typeId: string, claimsId: string;
beforeAll(async () => {
  [ama, kwame, yaw] = (await Promise.all(["ama.mensah", "kwame.boateng", "yaw.owusu"].map(signIn))) as [Agent, Agent, Agent];
  const meta = (await ama.get("/api/meta")).body;
  typeId = meta.changeTypes.find((t: { label: string }) => t.label === "IT / system").id;
  claimsId = meta.departments.find((d: { name: string }) => d.name === "Claims").id;
});
afterAll(() => prisma.$disconnect());

const newDraft = async () => (await ama.post("/api/changes").send({ typeId, departmentId: claimsId, title: "Attachment test" }).expect(201)).body;
const pdf = (name = "plan.pdf", body = "%PDF-1.4 test") => ["files", Buffer.from(body), { filename: name, contentType: "application/pdf" }] as const;
/** Collect a binary response body into a Buffer. */
const binary = (res: Response, cb: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on("data", (c: Buffer) => chunks.push(c));
  res.on("end", () => cb(null, Buffer.concat(chunks)));
};

describe("upload and download", () => {
  it("the requester attaches files; anyone who can see the change downloads them as attachments", async () => {
    const d = await newDraft();
    expect(d.actions.attach).toBe(true);
    const up = await ama.post(`/api/changes/${d.ref}/attachments`)
      .attach(...pdf("runbook.pdf", "%PDF-1.4 runbook"))
      .attach("files", Buffer.from("step 1\nstep 2"), { filename: "notes.txt", contentType: "text/plain" })
      .expect(201);
    expect(up.body.attachments.map((a: { fileName: string }) => a.fileName)).toEqual(["runbook.pdf", "notes.txt"]);
    const id = up.body.attachments[0].id;

    const dl = await ama.get(`/api/changes/${d.ref}/attachments/${id}`).buffer(true).parse(binary).expect(200);
    expect(dl.headers["content-type"]).toBe("application/octet-stream"); // never rendered inline
    expect(dl.headers["content-disposition"]).toMatch(/^attachment; filename="runbook.pdf"/);
    expect((dl.body as Buffer).toString()).toBe("%PDF-1.4 runbook");

    await yaw.get(`/api/changes/${d.ref}/attachments/${id}`).expect(404); // Ama's draft is private to her
    const activity = (await ama.get(`/api/changes/${d.ref}`)).body.activity.map((a: { action: string }) => a.action);
    expect(activity).toContain("Attached 2 files");
  });

  it("seeded attachments without a file on disk report that cleanly", async () => {
    const c = (await yaw.get("/api/changes/CHG-2026-0142").expect(200)).body;
    const res = await yaw.get(`/api/changes/CHG-2026-0142/attachments/${c.attachments[0].id}`).expect(404);
    expect(res.body.error.code).toBe("FILE_MISSING");
  });
});

describe("upload rules", () => {
  it("rejects disallowed types, mismatched content types, oversized and empty files", async () => {
    const d = await newDraft();
    const html = await ama.post(`/api/changes/${d.ref}/attachments`).attach("files", Buffer.from("<script>"), { filename: "evil.html", contentType: "text/html" }).expect(400);
    expect(html.body.error.message).toMatch(/file type not allowed/);
    const disguised = await ama.post(`/api/changes/${d.ref}/attachments`).attach("files", Buffer.from("<script>"), { filename: "report.pdf", contentType: "text/html" }).expect(400);
    expect(disguised.body.error.message).toMatch(/doesn't match/);
    const big = await ama.post(`/api/changes/${d.ref}/attachments`).attach(...pdf("big.pdf", "x".repeat(10 * 1024 * 1024 + 1))).expect(413);
    expect(big.body.error.message).toBe("A file is larger than 10 MB");
    await ama.post(`/api/changes/${d.ref}/attachments`).attach(...pdf("empty.pdf", "")).expect(400);
    await ama.post(`/api/changes/${d.ref}/attachments`).expect(400); // no files at all
  });

  it("never uses the uploaded file name as a path", async () => {
    const d = await newDraft();
    const res = await ama.post(`/api/changes/${d.ref}/attachments`).attach(...pdf("../../../evil.pdf")).expect(201);
    expect(res.body.attachments[0].fileName).toBe("evil.pdf");
    const row = await prisma.attachment.findUniqueOrThrow({ where: { id: res.body.attachments[0].id } });
    expect(row.storageKey).toMatch(new RegExp(`^${d.id}/[0-9a-f-]{36}\\.pdf$`));
    expect(existsSync(path.resolve(".test-uploads", row.storageKey))).toBe(true);
  });

  it("caps a change at 10 files", async () => {
    const d = await newDraft();
    for (let batch = 0; batch < 2; batch++) {
      const req = ama.post(`/api/changes/${d.ref}/attachments`);
      for (let i = 0; i < 5; i++) req.attach(...pdf(`f${batch}${i}.pdf`));
      await req.expect(201);
    }
    const res = await ama.post(`/api/changes/${d.ref}/attachments`).attach(...pdf("eleventh.pdf")).expect(409);
    expect(res.body.error.code).toBe("TOO_MANY_FILES");
  });
});

describe("who may add and remove", () => {
  it("only the requester; files can be added while pending but removed only while editable", async () => {
    const d = await newDraft();
    const added = (await ama.post(`/api/changes/${d.ref}/attachments`).attach(...pdf()).expect(201)).body;
    const file = await prisma.attachment.findUniqueOrThrow({ where: { id: added.attachments[0].id } });

    await kwame.post(`/api/changes/${d.ref}/attachments`).attach(...pdf()).expect(404); // can't even see the draft

    // Fill in the draft and submit it.
    await ama.patch(`/api/changes/${d.ref}`).send({ summary: "s", rollbackPlan: "r", plannedDate: "2026-11-20" }).expect(200);
    const pending = (await ama.post(`/api/changes/${d.ref}/submit`).send({ attest: true }).expect(200)).body;
    expect(pending.actions).toMatchObject({ attach: true, removeAttachment: false });

    await kwame.post(`/api/changes/${d.ref}/attachments`).attach(...pdf()).expect(403); // visible now, but not his
    await ama.post(`/api/changes/${d.ref}/attachments`).attach(...pdf("evidence.pdf")).expect(201);
    await ama.delete(`/api/changes/${d.ref}/attachments/${file.id}`).expect(409);

    // Back to the requester for rework: removal is allowed again, and the file leaves the disk.
    await kwame.post(`/api/changes/${d.ref}/decision`).send({ kind: "return", comment: "Remove the old plan" }).expect(200);
    await ama.delete(`/api/changes/${d.ref}/attachments/${file.id}`).expect(200);
    expect(existsSync(path.resolve(".test-uploads", file.storageKey))).toBe(false);
  });
});

describe("list filter for notifications", () => {
  it("filters by requester", async () => {
    const me = (await yaw.get("/api/auth/me")).body;
    const list = (await yaw.get("/api/changes").query({ requesterId: me.id, pageSize: 100 }).expect(200)).body;
    expect(list.items.length).toBeGreaterThan(0);
    expect(list.items.every((c: { requester: { id: string } }) => c.requester.id === me.id)).toBe(true);
  });
});
