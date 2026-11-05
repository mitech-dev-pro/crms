import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { extensionOf } from "@crms/shared";
import multer from "multer";
import { env } from "../config/env";
import { AppError } from "./errors";

const ROOT = path.resolve(env.UPLOAD_DIR);

/**
 * Multer keeps uploads in memory (10 MB cap per file via `fileSize`, which multer
 * applies to each file), so nothing touches the disk until we've checked it.
 */
export const uploadMiddleware = (maxFiles: number, maxBytes: number) =>
  multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: maxFiles, fields: 10 } }).array("files", maxFiles);

/**
 * Saves a file under a server-generated name: <changeId>/<uuid>.<ext>.
 * The user's file name is only stored in the database for display, never used
 * as a path, so names like "../../app.ts" can't write outside the folder.
 */
export async function saveUpload(changeId: string, originalName: string, data: Buffer) {
  const key = `${changeId}/${randomUUID()}.${extensionOf(originalName)}`;
  const full = resolveKey(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data, { flag: "wx" }); // wx: never overwrite
  return key;
}

export async function readUpload(key: string) {
  try {
    return await readFile(resolveKey(key));
  } catch {
    throw new AppError(404, "FILE_MISSING", "This file is no longer available");
  }
}

export const deleteUpload = (key: string) => rm(resolveKey(key), { force: true });

/** Maps a storage key to a path, refusing anything that would land outside the upload folder. */
function resolveKey(key: string) {
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new AppError(400, "BAD_PATH", "Invalid file reference");
  return full;
}

/** A filename safe for the Content-Disposition header (ASCII fallback + UTF-8 version). */
export function contentDisposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
