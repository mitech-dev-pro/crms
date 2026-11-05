import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-bright";

const variants: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-navy-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  danger: "border border-[var(--red-fg)]/40 bg-surface text-danger hover:bg-[var(--red-bg)]",
  ghost: "text-ink-2 hover:bg-surface-2",
};

export const buttonClass = (variant: Variant = "primary", extra = "") => `${base} ${variants[variant]} ${extra}`;

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean };

export function Button({ variant = "primary", loading, disabled, children, className = "", ...rest }: Props) {
  return (
    <button {...rest} disabled={disabled || loading} className={buttonClass(variant, className)}>
      {loading && <span className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function ButtonLink({ href, variant = "primary", children, className = "" }: { href: string; variant?: Variant; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
