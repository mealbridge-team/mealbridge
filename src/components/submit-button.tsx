"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className = "",
  disabled = false,
  confirm,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: keyof typeof buttonClass;
  className?: string;
  disabled?: boolean;
  /** Asks before submitting; for actions that can't be undone. */
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending || undefined}
      onClick={confirm ? (e) => !window.confirm(confirm) && e.preventDefault() : undefined}
      className={`${buttonClass[variant]} ${className}`}
    >
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}
