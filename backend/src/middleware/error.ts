import type { ErrorRequestHandler, RequestHandler } from "express";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { isProd } from "../config/env";
import { AppError } from "../lib/errors";

// Every error response has the same shape, so the frontend handles them in one place:
//   { error: { code, message, fields? } }

/** Runs when no route matched. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` } });
};

/**
 * Express recognises an error handler by its four arguments.
 * In Express 5, an async route that throws or rejects lands here automatically.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    // Map each issue to its field path, e.g. { title: "Title is required" }.
    // If a field breaks several rules, report the first (usually the most basic) one.
    const fields: Record<string, string> = {};
    for (const i of err.issues) fields[i.path.join(".") || "_"] ??= i.message;
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Some fields are invalid", fields } });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  // Upload limits (multer): too big → 413, too many files or a bad form → 400.
  if (err instanceof MulterError) {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    const message = tooBig ? "A file is larger than 10 MB" : err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE" ? "Too many files in one upload (at most 5)" : `Upload rejected (${err.code})`;
    res.status(tooBig ? 413 : 400).json({ error: { code: err.code, message } });
    return;
  }

  // Malformed JSON body from express.json().
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ error: { code: "BAD_JSON", message: "Request body is not valid JSON" } });
    return;
  }

  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL", message: isProd ? "Something went wrong" : String(err?.message ?? err) },
  });
};
