import { z } from "zod";
import type { Role, Screen } from "../enums";

export const loginSchema = z.object({
  // Trim and lowercase first, then check the format, so " Yaw.Owusu@… " still works.
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** What GET /api/auth/me and POST /api/auth/login return. Never includes the password hash. */
export type SessionUser = {
  id: string;
  code: string;
  name: string;
  email: string;
  title: string | null;
  role: Role;
  department: { id: string; name: string };
  permissions: Screen[];
};
