import Link from "next/link";

// The mark: two arches. Read as a bridge's spans, and as the "m" that starts "mealbridge".
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <path d="M8 24V15.5a4 4 0 0 1 8 0V24M16 15.5a4 4 0 0 1 8 0V24" fill="none" stroke="var(--on-brand)" strokeWidth="3.2" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/", tone = "ink" }: { href?: string; tone?: "ink" | "light" }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2.5 rounded-md ${tone === "light" ? "text-white" : "text-ink"}`}>
      <LogoMark />
      <span className="font-display text-[1.2rem] font-semibold tracking-[-0.03em]">mealbridge</span>
    </Link>
  );
}
