// Email content: one branded layout, plus a builder per kind of message.
// Every message has a plain-text version too (some mail clients and filters prefer it).
// Anything a user typed (titles, comments) is HTML-escaped before it goes into the HTML.
import { env } from "../config/env";
import type { Mail } from "../lib/mail";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const changeUrl = (ref: string) => `${env.APP_URL}/changes/${ref}`;

type Block = { kind: "p"; text: string } | { kind: "quote"; text: string; by?: string } | { kind: "facts"; rows: [string, string][] };

/** Builds the text and HTML versions from the same pieces, so they never drift apart. */
function compose(o: { to: string[]; subject: string; heading: string; blocks: Block[]; action?: { label: string; url: string }; footer?: string }): Mail {
  const text = [
    o.heading,
    "",
    ...o.blocks.flatMap((b) =>
      b.kind === "p" ? [b.text, ""] : b.kind === "quote" ? [`"${b.text}"${b.by ? ` (${b.by})` : ""}`, ""] : [...b.rows.map(([k, v]) => `${k}: ${v}`), ""],
    ),
    ...(o.action ? [`${o.action.label}: ${o.action.url}`, ""] : []),
    o.footer ?? "You're receiving this because of your role in MiLife ChangeHub.",
  ].join("\n");

  const body = o.blocks
    .map((b) => {
      if (b.kind === "p") return `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#3b4459">${esc(b.text)}</p>`;
      if (b.kind === "quote") {
        return `<blockquote style="margin:0 0 14px;padding:10px 14px;border-left:3px solid #17b3b5;background:#f7f9fb;font-size:14px;line-height:1.5;color:#18213a">${esc(b.text)}${b.by ? `<div style="margin-top:6px;font-size:12px;color:#5b6478">${esc(b.by)}</div>` : ""}</blockquote>`;
      }
      return `<table role="presentation" style="width:100%;margin:0 0 16px;border-collapse:collapse;font-size:14px">${b.rows
        .map(([k, v]) => `<tr><td style="padding:6px 0;color:#5b6478;width:38%">${esc(k)}</td><td style="padding:6px 0;color:#18213a;font-weight:600">${esc(v)}</td></tr>`)
        .join("")}</table>`;
    })
    .join("");

  const button = o.action
    ? `<p style="margin:22px 0 8px"><a href="${esc(o.action.url)}" style="display:inline-block;padding:11px 20px;border-radius:8px;background:#1d2a4d;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none">${esc(o.action.label)}</a></p>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#eef2f6;font-family:Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e3e8ef">
<tr><td style="height:5px;background:linear-gradient(90deg,#17b3b5 0 40%,#f2b85a 40% 55%,#0f7b5f 55% 80%,#1d2a4d 80%)"></td></tr>
<tr><td style="padding:22px 28px 6px;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#0b7f82">MiLife ChangeHub</td></tr>
<tr><td style="padding:0 28px 24px">
<h1 style="margin:6px 0 16px;font-size:21px;line-height:1.3;color:#18213a">${esc(o.heading)}</h1>
${body}${button}
</td></tr>
<tr><td style="padding:14px 28px;background:#f7f9fb;font-size:12px;line-height:1.5;color:#8a93a6">${esc(o.footer ?? "You're receiving this because of your role in MiLife ChangeHub.")}</td></tr>
</table></td></tr></table></body></html>`;

  return { to: o.to, subject: o.subject, text, html };
}

type ChangeInfo = { ref: string; title: string; requester: string; department: string; tier: string; plannedDate?: string | null };
const facts = (c: ChangeInfo): Block => ({
  kind: "facts",
  rows: [["Change", `${c.ref} · ${c.title}`], ["Raised by", c.requester], ["Department", c.department], ["Risk tier", c.tier], ...(c.plannedDate ? [["Planned date", c.plannedDate] as [string, string]] : [])],
});

export const emails = {
  needsApproval: (to: string[], c: ChangeInfo, stage: string) =>
    compose({
      to, subject: `Approval needed: ${c.ref} ${c.title}`, heading: `${c.ref} is waiting for your decision`,
      blocks: [{ kind: "p", text: `This change has reached the ${stage} stage. Please approve, reject or return it.` }, facts(c)],
      action: { label: "Review the change", url: changeUrl(c.ref) },
    }),

  decided: (to: string[], c: ChangeInfo, outcome: "approved" | "scheduled" | "rejected" | "returned", by: string, comment?: string | null) => {
    const heading = {
      approved: `${c.ref} is fully approved`,
      scheduled: `${c.ref} is approved and scheduled`,
      rejected: `${c.ref} was rejected`,
      returned: `${c.ref} was returned to you for rework`,
    }[outcome];
    const lead = {
      approved: "Every approval stage is complete. Add a planned date when you're ready to schedule it.",
      scheduled: "Every approval stage is complete and the change is on the calendar.",
      rejected: "The change won't go ahead as submitted.",
      returned: "Make the requested changes, then resubmit it from the change page.",
    }[outcome];
    return compose({
      to, subject: `${heading}: ${c.title}`, heading,
      blocks: [{ kind: "p", text: lead }, ...(comment ? [{ kind: "quote" as const, text: comment, by }] : [{ kind: "p" as const, text: `Decided by ${by}.` }]), facts(c)],
      action: { label: "Open the change", url: changeUrl(c.ref) },
    });
  },

  readyToImplement: (to: string[], c: ChangeInfo, window?: string | null) =>
    compose({
      to, subject: `Ready to implement: ${c.ref} ${c.title}`, heading: `You're implementing ${c.ref}`,
      blocks: [{ kind: "p", text: `It's fully approved${c.plannedDate ? ` for ${c.plannedDate}${window ? `, ${window}` : ""}` : ""}. Start it from the change page when the window opens.` }, facts(c)],
      action: { label: "Open the change", url: changeUrl(c.ref) },
    }),

  reminder: (to: string[], c: ChangeInfo, stage: string, waitingDays: number) =>
    compose({
      to, subject: `Reminder: ${c.ref} has waited ${waitingDays} working days for ${stage}`, heading: `${c.ref} is still waiting for a decision`,
      blocks: [{ kind: "p", text: `It has been at the ${stage} stage for ${waitingDays} working days. Decisions are due within 2 working days.` }, facts(c)],
      action: { label: "Review the change", url: changeUrl(c.ref) },
    }),

  escalation: (to: string[], c: ChangeInfo, stage: string, waitingDays: number) =>
    compose({
      to, subject: `Escalation: ${c.ref} stuck at ${stage} for ${waitingDays} working days`, heading: `${c.ref} needs a nudge`,
      blocks: [
        { kind: "p", text: `No one has decided the ${stage} stage in ${waitingDays} working days, even after a reminder. You're receiving this as Change Manager.` },
        facts(c),
      ],
      action: { label: "Open the change", url: changeUrl(c.ref) },
    }),

  comment: (to: string[], c: ChangeInfo, author: string, body: string) =>
    compose({
      to, subject: `New comment on ${c.ref}: ${c.title}`, heading: `${author} commented on ${c.ref}`,
      blocks: [{ kind: "quote", text: body, by: author }, facts(c)],
      action: { label: "Reply on the change", url: `${changeUrl(c.ref)}?tab=discussion` },
      footer: "You're receiving this because you raised, decided or commented on this change.",
    }),

  standIn: (to: string[], from: string, role: string, start: string, end: string, reason?: string | null) =>
    compose({
      to, subject: `You're standing in for ${from} (${role})`, heading: `You're covering for ${from}`,
      blocks: [
        { kind: "p", text: `From ${start} to ${end} you can decide ${role} approval stages on ${from}'s behalf. Those changes appear in your approvals.` },
        ...(reason ? [{ kind: "quote" as const, text: reason }] : []),
      ],
      action: { label: "Open my approvals", url: `${env.APP_URL}/approvals` },
    }),

  passwordReset: (to: string[], name: string, url: string, minutes: number) =>
    compose({
      to, subject: "Reset your ChangeHub password", heading: "Reset your password",
      blocks: [
        { kind: "p", text: `Hi ${name.split(" ")[0]}, someone asked to reset the password for your account. If it was you, use the button below within ${minutes} minutes. It works once.` },
        { kind: "p", text: "If you didn't ask for this, ignore this email: your password stays the same." },
      ],
      action: { label: "Choose a new password", url },
      footer: "For your security, ChangeHub never asks for your password by email.",
    }),

  passwordChanged: (to: string[], name: string) =>
    compose({
      to, subject: "Your ChangeHub password was changed", heading: "Your password was changed",
      blocks: [{ kind: "p", text: `Hi ${name.split(" ")[0]}, the password for your account was just changed and other devices were signed out. If this wasn't you, contact your System Administrator straight away.` }],
      action: { label: "Sign in", url: `${env.APP_URL}/login` },
    }),
};
