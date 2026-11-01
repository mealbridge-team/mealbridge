import type { ReactNode } from "react";
import type { TripStatus } from "@/db/schema";
import { formatUsd } from "@/domain/stipend";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-3xl border border-line bg-paper p-5 shadow-card sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-tomato">{eyebrow}</p>}
      <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2 max-w-2xl text-muted">{subtitle}</p>}
    </div>
  );
}

export type Tone = "leaf" | "tomato" | "saffron" | "berry" | "sky" | "muted";
const TONES: Record<Tone, string> = {
  leaf: "bg-leaf-soft text-leaf",
  tomato: "bg-tomato-soft text-tomato",
  saffron: "bg-saffron-soft text-saffron",
  berry: "bg-berry-soft text-berry",
  sky: "bg-sky-soft text-sky",
  muted: "bg-line/70 text-muted",
};

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>
      {children}
    </span>
  );
}

const TRIP_STATUS: Record<TripStatus, { label: string; tone: Tone }> = {
  unfunded: { label: "Needs funding", tone: "tomato" },
  funded: { label: "Funded, finding driver", tone: "saffron" },
  assigned: { label: "Driver on the way", tone: "sky" },
  picked_up: { label: "Food on board", tone: "sky" },
  delivered: { label: "Awaiting shelter", tone: "saffron" },
  needs_review: { label: "Needs review", tone: "berry" },
  verified: { label: "Verified", tone: "leaf" },
  payout_pending: { label: "Paying driver", tone: "leaf" },
  paid: { label: "Driver paid", tone: "leaf" },
  cancelled: { label: "Cancelled", tone: "muted" },
};

export function TripStatusBadge({ status }: { status: TripStatus }) {
  const s = TRIP_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

// Where a rescue is, as four steps everyone understands.
const STEP_OF: Record<TripStatus, number> = {
  unfunded: 1,
  funded: 1,
  assigned: 2,
  picked_up: 3,
  delivered: 3,
  needs_review: 3,
  verified: 4,
  payout_pending: 4,
  paid: 5,
  cancelled: 0,
};

export function RescueSteps({ status }: { status: TripStatus }) {
  const reached = STEP_OF[status];
  const steps = ["Matched", "Driver booked", "Delivered", "Driver paid"];
  if (reached === 0) return <p className="text-xs text-muted">Cancelled</p>;
  return (
    <ol className="flex items-center gap-1.5" aria-label="Rescue progress">
      {steps.map((label, i) => {
        const done = reached > i + 1 || (i === 3 && reached === 5);
        const current = !done && reached === i + 1;
        return (
          <li key={label} className="flex flex-1 flex-col gap-1">
            <span className={`h-1.5 rounded-full ${done ? "bg-leaf" : current ? "bg-saffron" : "bg-line"}`} />
            <span className={`text-[11px] ${done || current ? "text-ink" : "text-muted"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Money({ cents }: { cents: number }) {
  return <span className="tabular-nums">{formatUsd(cents)}</span>;
}

export function Stat({ value, label, tone = "leaf" }: { value: ReactNode; label: string; tone?: "leaf" | "tomato" | "ink" }) {
  const color = tone === "leaf" ? "text-leaf" : tone === "tomato" ? "text-tomato" : "text-ink";
  return (
    <div>
      <p className={`font-display text-3xl font-semibold tabular-nums ${color}`}>{value}</p>
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export function Notice({ tone = "saffron", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={`rounded-2xl px-4 py-3 text-sm ${TONES[tone]}`}>{children}</div>;
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-line" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}

export const buttonClass = {
  primary:
    "inline-flex items-center justify-center gap-2 rounded-2xl bg-leaf px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50",
  accent:
    "inline-flex items-center justify-center gap-2 rounded-2xl bg-tomato px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-2xl border border-line bg-paper px-4 py-2.5 text-sm font-semibold transition hover:bg-cream disabled:opacity-50",
  // PayPal's own button colours, for actions that open PayPal.
  paypal:
    "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#ffc439] px-4 py-2.5 text-sm font-semibold text-[#111] transition hover:brightness-95 disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-2xl border border-berry/30 bg-berry-soft px-3 py-2 text-sm font-semibold text-berry transition hover:brightness-95 disabled:opacity-50",
};

export const inputClass = "w-full rounded-2xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-leaf";

export const AREA_LABEL: Record<string, string> = {
  oakland: "Oakland",
  berkeley: "Berkeley",
  "san-francisco": "San Francisco",
};

export function timeLabel(date: Date | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }).format(date);
}

// "tree_nuts" -> "tree nuts", for allergen and diet ids shown to people.
export function readable(ids: string[]) {
  return ids.map((id) => id.replaceAll("_", " ")).join(", ");
}
