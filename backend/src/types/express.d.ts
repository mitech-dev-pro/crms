import type { Role } from "@crms/shared";

// Teach TypeScript that requireAuth adds `req.user` to every request after it.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: Role;
        departmentId: string;
      };
    }
  }
}

export {};
