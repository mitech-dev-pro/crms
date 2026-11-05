"use client";

import { ATTACHMENT_ACCEPT, MAX_ATTACHMENTS_PER_CHANGE, MAX_FILES_PER_UPLOAD, attachmentProblem, type ChangeDetail } from "@crms/shared";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { fileSize } from "@/lib/format";
import { attachmentUrl, useRemoveAttachment, useUploadAttachments } from "@/lib/queries";

/** File list with download links; the requester can add (and, while editable, remove) files. */
export default function Attachments({ c }: { c: ChangeDetail }) {
  const upload = useUploadAttachments(c.ref);
  const remove = useRemoveAttachment(c.ref);
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const room = MAX_ATTACHMENTS_PER_CHANGE - c.attachments.length;

  const onPick = (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (input.current) input.current.value = ""; // so picking the same file again still triggers
    if (!files.length) return;
    // Same rules as the server, checked here for an instant message.
    const issues = files.map((f) => attachmentProblem(f.name, f.type, f.size)).filter(Boolean);
    if (files.length > Math.min(room, MAX_FILES_PER_UPLOAD)) issues.push(`You can add ${Math.min(room, MAX_FILES_PER_UPLOAD)} more file(s) here`);
    setProblem(issues.length ? issues.join("; ") : null);
    if (!issues.length) upload.mutate(files);
  };

  const error = problem ?? upload.error?.message ?? remove.error?.message;

  return (
    <div>
      {c.attachments.length ? (
        <ul className="space-y-1">
          {c.attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2">
              <Paperclip size={14} className="shrink-0 text-muted" />
              <a href={attachmentUrl(c.ref, a.id)} download className="truncate font-semibold text-teal hover:underline">{a.fileName}</a>
              <span className="shrink-0 text-xs text-muted">{fileSize(a.sizeBytes)}</span>
              <a href={attachmentUrl(c.ref, a.id)} download aria-label={`Download ${a.fileName}`} className="rounded p-1 text-muted hover:bg-surface-2"><Download size={13} /></a>
              {c.actions.removeAttachment && (
                <button
                  onClick={() => confirm(`Remove ${a.fileName}?`) && remove.mutate(a.id)}
                  aria-label={`Remove ${a.fileName}`}
                  className="rounded p-1 text-muted hover:bg-[var(--red-bg)] hover:text-danger"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p>None</p>
      )}

      {c.actions.attach && room > 0 && (
        <div className="mt-3">
          <input ref={input} type="file" multiple accept={ATTACHMENT_ACCEPT} className="hidden" onChange={(e) => onPick(e.target.files)} aria-label="Add files" />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={upload.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-line-strong px-3 py-1.5 text-sm font-bold text-ink-2 hover:bg-surface-2 disabled:opacity-50"
          >
            <Upload size={14} /> {upload.isPending ? "Uploading…" : "Add files"}
          </button>
          <p className="mt-1 text-xs text-muted">PDF, Office, images, CSV or text · up to 10 MB each · {room} of {MAX_ATTACHMENTS_PER_CHANGE} left</p>
        </div>
      )}
      {error && <p role="alert" className="mt-1 text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
