/**
 * Minimal CSV parser (RFC 4180): handles quoted cells, doubled quotes, commas
 * and newlines inside quotes, and CRLF or LF line endings. Blank lines are dropped.
 * Ported from the prototype's parseCsv.
 */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, ""); // Excel's UTF-8 marker
  const out: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (quoted) {
      if (c === '"') {
        if (t[i + 1] === '"') { cur += '"'; i++; } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(cur); out.push(row); row = []; cur = "";
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out.filter((r) => r.some((x) => x.trim()));
}
