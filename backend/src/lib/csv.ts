import type { Response } from "express";

type Cell = string | number | boolean | null | undefined;

/**
 * One CSV cell. Two safety rules:
 *  - quote values containing commas, quotes or newlines (and double any quotes);
 *  - prefix values starting with = + - @ (or tab/CR) with an apostrophe, so a
 *    spreadsheet shows them as text instead of running them as a formula
 *    ("CSV injection"), since cell text here comes from users.
 */
function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: Cell[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n");

/** Sends rows as a downloadable CSV. The BOM makes Excel read it as UTF-8 (₵, names with accents). */
export function sendCsv(res: Response, filename: string, rows: Cell[][]) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send("﻿" + toCsv(rows));
}

/** "crms-changes-2026-11-05.csv" */
export const datedName = (base: string) => `crms-${base}-${new Date().toISOString().slice(0, 10)}.csv`;
