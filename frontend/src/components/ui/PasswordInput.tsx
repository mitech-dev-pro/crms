"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState, type InputHTMLAttributes, type KeyboardEvent } from "react";
import { Input } from "./Form";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean };

/**
 * Password field with a show/hide button and a Caps Lock warning.
 * Works with React Hook Form's register() like a normal input.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput({ id, onKeyDown, onKeyUp, onBlur, ...rest }, ref) {
  const [shown, setShown] = useState(false);
  const [caps, setCaps] = useState(false);
  const readCaps = (e: KeyboardEvent<HTMLInputElement>) => setCaps(e.getModifierState?.("CapsLock") ?? false);

  return (
    <div>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          type={shown ? "text" : "password"}
          className="pr-11"
          aria-describedby={caps ? `${id}-caps` : undefined}
          onKeyDown={(e) => { readCaps(e); onKeyDown?.(e); }}
          onKeyUp={(e) => { readCaps(e); onKeyUp?.(e); }}
          onBlur={(e) => { setCaps(false); onBlur?.(e); }}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          aria-controls={id}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-teal-bright"
        >
          {shown ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {caps && (
        <p id={`${id}-caps`} className="mt-1.5 text-xs font-semibold" style={{ color: "var(--amber-fg)" }}>
          Caps Lock is on
        </p>
      )}
    </div>
  );
});
