// Upload rules, shared so the browser can warn early. The server enforces them.

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MAX_ATTACHMENTS_PER_CHANGE = 10;
export const MAX_FILES_PER_UPLOAD = 5;

/** Allowed extensions and the MIME types a browser may report for them. */
export const ALLOWED_ATTACHMENTS: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  csv: ["text/csv", "application/vnd.ms-excel", "text/plain"],
  txt: ["text/plain"],
};

/** For <input accept="…">. */
export const ATTACHMENT_ACCEPT = Object.keys(ALLOWED_ATTACHMENTS).map((e) => `.${e}`).join(",");

export const extensionOf = (name: string) => name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? "";

/** Why a file can't be attached, or null if it's fine. */
export function attachmentProblem(name: string, mime: string, size: number): string | null {
  const allowed = ALLOWED_ATTACHMENTS[extensionOf(name)];
  if (!allowed) return `${name}: file type not allowed (use ${Object.keys(ALLOWED_ATTACHMENTS).join(", ")})`;
  // Some browsers send an empty or generic type; only reject a type that clearly contradicts the extension.
  if (mime && mime !== "application/octet-stream" && !allowed.includes(mime)) return `${name}: content type ${mime} doesn't match the file extension`;
  if (size > MAX_ATTACHMENT_BYTES) return `${name}: larger than 10 MB`;
  if (size === 0) return `${name}: the file is empty`;
  return null;
}
