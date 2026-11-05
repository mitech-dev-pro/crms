import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const control = (invalid?: boolean) =>
  `w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink placeholder:text-faint outline-none focus:border-teal-bright focus:ring-2 focus:ring-teal-bright/20 ${
    invalid ? "border-danger-ring" : "border-line-strong"
  }`;

/** Label + control + error message, with the error linked for screen readers. */
export function Field({ label, hint, error, htmlFor, children }: { label: string; hint?: string; error?: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-bold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-semibold text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

type WithInvalid = { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & WithInvalid>(function Input({ invalid, className = "", ...rest }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={`${control(invalid)} ${className}`} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & WithInvalid>(function Textarea({ invalid, className = "", ...rest }, ref) {
  return <textarea ref={ref} rows={3} aria-invalid={invalid || undefined} className={`${control(invalid)} ${className}`} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & WithInvalid>(function Select({ invalid, className = "", ...rest }, ref) {
  return <select ref={ref} aria-invalid={invalid || undefined} className={`${control(invalid)} ${className}`} {...rest} />;
});

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: ReactNode }>(function Checkbox({ label, ...rest }, ref) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
      <input ref={ref} type="checkbox" className="size-4 accent-[var(--teal)]" {...rest} />
      {label}
    </label>
  );
});

/** A selectable card, used for choosing type, impact and likelihood in the wizard. */
export function OptionCard({ selected, title, description, onClick }: { selected: boolean; title: string; description?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
        selected ? "border-teal-bright bg-teal-tint" : "border-line bg-surface hover:border-line-strong"
      }`}
    >
      <span className="block text-sm font-bold text-ink">{title}</span>
      {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
    </button>
  );
}
