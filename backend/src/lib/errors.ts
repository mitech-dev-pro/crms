/**
 * An error we throw on purpose, carrying the HTTP status to send.
 * Anything else that reaches the error handler is treated as a 500 bug.
 *
 *   throw new AppError(403, "FORBIDDEN", "You cannot approve your own change");
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    /** Optional per-field messages, shown next to form fields (same as validation errors). */
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthenticated = (message = "Please sign in") => new AppError(401, "UNAUTHENTICATED", message);
export const notFound =(what = "Resource") => new AppError(404, "NOT_FOUND", `${what} not found`);
export const forbidden = (message = "You do not have access to this") => new AppError(403, "FORBIDDEN", message);
