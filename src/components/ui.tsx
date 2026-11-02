import type { ReactNode } from "react";
import type { TripStatus } from "@/db/schema";
import { formatUsd } from "@/domain/stipend";

// Layout

export function Container({ children, className = "", size = "wide" }: { children: ReactNode; className?: string; size?: "wide" | "narrow" | "app" }) {
  const width = size === "narrow" ? "max-w-2xl" : size === "app" ? "max-w-5xl" : "max-w-6xl";
  return <div className={`mx-auto w-full ${width} px-4 sm:px-6 ${className}`}>{children}</div>;
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-brand">{children}</p>;
}

export function PageHeader({
  kicker,
  title,
  description,
  art,
  children,
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Illustration standing on the header's bottom rule (see components/page-art.tsx). */
  art?: ReactNode;
  children?: ReactNode;
}) {
  if (art) {
    return (
      <header className="grid items-end gap-x-10 border-b border-line pt-8 sm:pt-10 md:grid-cols-[1.15fr_1fr]">
        <div className="max-w-2xl pb-8 md:pb-12">
          {kicker && <Kicker>{kicker}</Kicker>}
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{title}</h1>
          {description && <p className="mt-4 text-lg leading-relaxed text-muted">{description}</p>}
          {children && <div className="mt-6">{children}</div>}
        </div>
        {art}
      </header>
    );
  }
  return (
    <header className="flex flex-col gap-5 border-b border-line pb-8 pt-10 sm:pt-14 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {kicker && <Kicker>{kicker}</Kicker>}
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{title}</h1>
        {description && <p className="mt-4 text-lg leading-relaxed text-muted">{description}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </header>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-bg p-5 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            {title && <h2 className="font-display text-lg font-semibold tracking-[-0.01em]">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

// Status

export type Tone = "neutral" | "ok" | "warn" | "bad" | "info";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface text-muted",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${TONE[tone]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

const TRIP_STATUS: Record<TripStatus, { label: string; tone: Tone }> = {
  unfunded: { label: "Needs funding", tone: "warn" },
  funded: { label: "Finding a driver", tone: "info" },
  assigned: { label: "Driver on the way", tone: "info" },
  picked_up: { label: "Food on board", tone: "info" },
  delivered: { label: "Awaiting shelter", tone: "warn" },
  needs_review: { label: "Needs review", tone: "bad" },
  verified: { label: "Verified", tone: "ok" },
  payout_pending: { label: "Paying driver", tone: "ok" },
  paid: { label: "Complete", tone: "ok" },
  cancelled: { label: "Cancelled", tone: "neutral" },
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
const STEPS = ["Matched", "Driver booked", "Delivered", "Driver paid"];

export function RescueSteps({ status }: { status: TripStatus }) {
  const reached = STEP_OF[status];
  if (reached === 0) return <p className="text-sm text-muted">Cancelled</p>;
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Rescue progress">
      {STEPS.map((label, i) => {
        const done = reached > i + 1 || (i === 3 && reached === 5);
        const current = !done && reached === i + 1;
        return (
          <li key={label} className="min-w-0" aria-current={current ? "step" : undefined}>
            <span className={`block h-1 rounded-full ${done ? "bg-brand" : current ? "bg-brand/40" : "bg-line"}`} />
            <span className={`mt-1.5 block truncate text-xs ${done || current ? "text-ink" : "text-muted"}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Content

export function Money({ cents }: { cents: number }) {
  return <span className="tabular-nums">{formatUsd(cents)}</span>;
}

export function Stat({ value, label, size = "md" }: { value: ReactNode; label: ReactNode; size?: "md" | "lg" }) {
  return (
    <div>
      <p className={`font-display font-semibold tabular-nums tracking-[-0.03em] ${size === "lg" ? "text-5xl sm:text-6xl" : "text-3xl"}`}>{value}</p>
      <p className="mt-1.5 text-sm text-muted">{label}</p>
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface px-5 py-8 text-center text-sm text-muted">
      <p className="mx-auto max-w-sm">{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", title, children }: { tone?: Tone; title?: ReactNode; children?: ReactNode }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className={`rounded-xl px-4 py-3 text-sm ${TONE[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-0.5 text-ink/80" : ""}>{children}</div>}
    </div>
  );
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-4 animate-pulse rounded bg-surface" style={{ width: `${92 - i * 14}%` }} />
      ))}
    </div>
  );
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-line text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// Controls

const BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45";
export const buttonClass = {
  primary: `${BASE} bg-brand text-on-brand hover:bg-brand-hover`,
  secondary: `${BASE} border border-line bg-bg text-ink hover:bg-surface`,
  ghost: `${BASE} px-2 text-ink underline-offset-4 hover:underline`,
  danger: `${BASE} border border-line bg-bg text-bad hover:bg-bad-soft`,
  donate: `${BASE} bg-accent text-on-accent hover:bg-accent-hover`,
  // PayPal's own button colour, for actions that open PayPal.
  paypal: `${BASE} bg-[#ffc439] text-[#111] hover:bg-[#f2b72e]`,
};
export const smallButton = "min-h-9 px-3 text-[13px]";

export const inputClass =
  "w-full min-h-11 rounded-lg border border-line bg-bg px-3.5 py-2.5 text-base text-ink placeholder:text-muted/80 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 sm:text-sm";

export function Field({ label, hint, htmlFor, children }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

// Formatting

export const AREA_LABEL: Record<string, string> = {
  oakland: "Oakland",
  berkeley: "Berkeley",
  "san-francisco": "San Francisco",
};

export function timeLabel(date: Date | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" }).format(date);
}

export function dateLabel(date: Date | null | undefined) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" }).format(date);
}

// "tree_nuts" -> "tree nuts", for allergen and diet ids shown to people.
export function readable(ids: string[]) {
  return ids.map((id) => id.replaceAll("_", " ")).join(", ");
}
