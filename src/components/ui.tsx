import type { ReactNode } from "react";
import type { TripStatus } from "@/db/schema";
import { formatUsd } from "@/domain/stipend";

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-paper p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-lg font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
    </div>
  );
}

type Tone = "leaf" | "saffron" | "berry" | "sky" | "muted";
const TONES: Record<Tone, string> = {
  leaf: "bg-leaf-soft text-leaf",
  saffron: "bg-saffron-soft text-saffron",
  berry: "bg-berry-soft text-berry",
  sky: "bg-sky-soft text-sky",
  muted: "bg-line text-muted",
};

export function Badge({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
}

const TRIP_STATUS: Record<TripStatus, { label: string; tone: Tone }> = {
  unfunded: { label: "Needs funding", tone: "berry" },
  funded: { label: "Funded, finding driver", tone: "saffron" },
  assigned: { label: "Driver booked", tone: "sky" },
  picked_up: { label: "On the way", tone: "sky" },
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

export function Money({ cents }: { cents: number }) {
  return <span className="tabular-nums">{formatUsd(cents)}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{children}</p>;
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
    "inline-flex items-center justify-center gap-2 rounded-xl bg-leaf px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-medium hover:bg-cream disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-berry/40 bg-berry-soft px-3 py-2 text-sm font-medium text-berry hover:opacity-90 disabled:opacity-50",
};

export const AREA_LABEL: Record<string, string> = {
  oakland: "Oakland",
  berkeley: "Berkeley",
  "san-francisco": "San Francisco",
};

export function timeLabel(date: Date | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }).format(date);
}
