import request from "supertest";
import { createApp } from "../src/app";

export const app = createApp();
export type Agent = ReturnType<typeof request.agent>;

/** A signed-in browser-like client: it keeps the session cookie between requests. */
export async function signIn(handle: string): Promise<Agent> {
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email: `${handle}@milife.com.gh`, password: "demo-password" }).expect(200);
  return agent;
}
