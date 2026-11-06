// Session revocation, forced password change and login rate limiting.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db";
import { app, signIn, type Agent } from "./helpers";

let selorm: Agent;
let deptId: string;
beforeAll(async () => {
  selorm = await signIn("selorm.dzidzienyo");
  deptId = (await selorm.get("/api/meta").expect(200)).body.departments[0].id;
});
afterAll(() => prisma.$disconnect());

/** The raw session cookie from a login response, to replay it like a thief would. */
const sessionCookie = (res: request.Response) => (res.headers["set-cookie"] as unknown as string[]).find((c) => c.startsWith("crms_session="))!.split(";")[0]!;

/** Invite a user and activate them with a temporary password. */
async function makeUser(name: string, role = "requester") {
  const email = `${name.toLowerCase().replace(/ /g, ".")}@milife.com.gh`;
  const u = (await selorm.post("/api/admin/users").send({ name, email, departmentId: deptId, role }).expect(201)).body;
  const { temporaryPassword } = (await selorm.post(`/api/admin/users/${u.id}/reset-password`).expect(200)).body;
  return { id: u.id as string, email, temporaryPassword: temporaryPassword as string };
}

describe("session revocation", () => {
  it("logout kills the token everywhere, including a copied one", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "nana.agyeman@milife.com.gh", password: "demo-password" }).expect(200);
    const stolen = sessionCookie(res);
    await request(app).get("/api/auth/me").set("Cookie", stolen).expect(200);

    await request(app).post("/api/auth/logout").set("Cookie", stolen).expect(204);
    await request(app).get("/api/auth/me").set("Cookie", stolen).expect(401);
  });

  it("a revoked token can't sign the user out of their new session", async () => {
    const first = sessionCookie(await request(app).post("/api/auth/login").send({ email: "fiifi.sam@milife.com.gh", password: "demo-password" }).expect(200));
    await request(app).post("/api/auth/logout").set("Cookie", first).expect(204);
    const second = sessionCookie(await request(app).post("/api/auth/login").send({ email: "fiifi.sam@milife.com.gh", password: "demo-password" }).expect(200));
    await request(app).post("/api/auth/logout").set("Cookie", first).expect(204); // old token: no effect
    await request(app).get("/api/auth/me").set("Cookie", second).expect(200);
  });

  it("changing role ends that user's sessions", async () => {
    const u = await makeUser("Role Changer");
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: u.email, password: u.temporaryPassword }).expect(200);
    await agent.post("/api/auth/change-password").send({ currentPassword: u.temporaryPassword, newPassword: "Str0ngEnough1" }).expect(200);
    await agent.get("/api/changes").expect(200);

    await selorm.patch(`/api/admin/users/${u.id}`).send({ role: "lineManager" }).expect(200);
    await agent.get("/api/changes").expect(401);
  });
});

describe("temporary passwords", () => {
  it("block everything until a new, strong password is chosen, then other sessions end", async () => {
    const u = await makeUser("Temp Holder");
    const agent = request.agent(app);
    const other = request.agent(app);
    const me = (await agent.post("/api/auth/login").send({ email: u.email, password: u.temporaryPassword }).expect(200)).body;
    expect(me.mustChangePassword).toBe(true);
    await other.post("/api/auth/login").send({ email: u.email, password: u.temporaryPassword }).expect(200);

    // Only "who am I" and "change password" work.
    await agent.get("/api/auth/me").expect(200);
    const blocked = await agent.get("/api/changes").expect(403);
    expect(blocked.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const wrong = await agent.post("/api/auth/change-password").send({ currentPassword: "nope", newPassword: "Str0ngEnough1" }).expect(400);
    expect(wrong.body.error.message).toBe("Your current password is incorrect");
    const weak = await agent.post("/api/auth/change-password").send({ currentPassword: u.temporaryPassword, newPassword: "short" }).expect(400);
    expect(weak.body.error.fields.newPassword).toBe("Use at least 10 characters");
    const noDigit = await agent.post("/api/auth/change-password").send({ currentPassword: u.temporaryPassword, newPassword: "onlyletterslong" }).expect(400);
    expect(noDigit.body.error.fields.newPassword).toBe("Include at least one number");

    const done = (await agent.post("/api/auth/change-password").send({ currentPassword: u.temporaryPassword, newPassword: "N3wPassword!" }).expect(200)).body;
    expect(done.mustChangePassword).toBe(false);
    await agent.get("/api/changes").expect(200); // fresh cookie from the change works
    await other.get("/api/auth/me").expect(401); // the other device was signed out

    await request(app).post("/api/auth/login").send({ email: u.email, password: u.temporaryPassword }).expect(401);
    await request(app).post("/api/auth/login").send({ email: u.email, password: "N3wPassword!" }).expect(200);
  });
});

describe("login rate limiting", () => {
  it("allows 10 failures per account and address, then answers 429", async () => {
    const attempt = () => request(app).post("/api/auth/login").send({ email: "kofi.boakye@milife.com.gh", password: "wrong" });
    for (let i = 0; i < 10; i++) await attempt().expect(401);
    const limited = await attempt().expect(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(limited.headers["retry-after"]).toBeDefined();

    // Other accounts from the same address are unaffected.
    await request(app).post("/api/auth/login").send({ email: "efua.asante@milife.com.gh", password: "demo-password" }).expect(200);
  });
});
