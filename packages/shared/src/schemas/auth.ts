import { z } from "zod";
import type { Role, Screen } from "../enums";

export const loginSchema = z.object({
  // Trim and lowercase first, then check the format, so " Yaw.Owusu@… " still works.
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address")),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Password rules: long enough to resist guessing, with a mix of letters and digits. */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128, "Use at most 128 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

/** POST /api/auth/change-password */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** The change-password form adds a confirmation box (checked in the browser only). */
export const changePasswordFormSchema = changePasswordSchema
  .extend({ confirm: z.string().min(1, "Repeat the new password") })
  .refine((v) => v.newPassword === v.confirm, { message: "The passwords don't match", path: ["confirm"] });
export type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;

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
  /** True after an admin issued a temporary password: everything else is blocked until it's changed. */
  mustChangePassword: boolean;
};
