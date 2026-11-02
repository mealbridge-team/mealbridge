"use client";

import { useFormStatus } from "react-dom";
import { ArrowRight, Check } from "lucide-react";

// One person on the demo sign-in page: the whole row is the button.
export function PersonaButton({ name, detail, current }: { name: string; detail: string; current: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className={`group flex min-h-14 w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left transition-colors ${
        current ? "border-brand bg-brand-soft" : "border-line bg-bg hover:border-ink"
      }`}
    >
      <span className="min-w-0">
        <span className="block font-semibold leading-snug">{name}</span>
        <span className="block truncate text-sm text-muted">{detail}</span>
      </span>
      {pending ? (
        <span className="text-sm text-muted">Signing in…</span>
      ) : current ? (
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-brand">
          <Check className="h-4 w-4" aria-hidden /> Signed in
        </span>
      ) : (
        <ArrowRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink" aria-hidden />
      )}
    </button>
  );
}
