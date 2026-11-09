import { Check, Circle } from "lucide-react";

/** The same rules as the shared passwordSchema, shown live as a checklist. */
const RULES: { label: string; test: (pw: string, confirm: string) => boolean }[] = [
  { label: "At least 10 characters", test: (pw) => pw.length >= 10 },
  { label: "Contains a letter", test: (pw) => /[A-Za-z]/.test(pw) },
  { label: "Contains a number", test: (pw) => /\d/.test(pw) },
  { label: "Both new passwords match", test: (pw, c) => pw.length > 0 && pw === c },
];

/** Ticks each password rule as it's met while typing. */
export default function PasswordChecklist({ password, confirm }: { password: string; confirm: string }) {
  return (
    <ul aria-label="Password requirements" className="grid gap-1.5 rounded-lg bg-surface-2 px-3.5 py-3 text-xs sm:grid-cols-2">
      {RULES.map((r) => {
        const ok = r.test(password, confirm);
        return (
          <li key={r.label} className={`flex items-center gap-1.5 transition-colors ${ok ? "font-semibold text-[var(--green-fg)]" : "text-muted"}`}>
            {ok ? <Check size={13} strokeWidth={3} aria-hidden /> : <Circle size={11} aria-hidden />}
            {r.label}
            <span className="sr-only">{ok ? " (met)" : " (not met yet)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
