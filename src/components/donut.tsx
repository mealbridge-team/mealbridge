import type { CSSProperties, ReactNode } from "react";

// A single-ring donut with the headline in the middle and a legend that leads with the percentage:
// one clear answer to "where does the money come from?". Segments sweep in once (CSS, see
// globals.css "Donut"); the legend carries every number, so colour is never the only key.

export type Slice = { label: string; value: number; color: string; detail?: string };

const R = 80;
const C = 2 * Math.PI * R;
const GAP = 3;

export function Donut({ slices, center, title }: { slices: Slice[]; center: ReactNode; title: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const shown = slices.filter((s) => s.value > 0);
  const lengths = shown.map((s) => (total ? (s.value / total) * C : 0));
  const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <figure className="grid items-center gap-8 sm:grid-cols-[minmax(0,15rem)_1fr]">
      <div className="relative mx-auto aspect-square w-full max-w-60">
        <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" role="img" aria-label={title}>
          <circle cx={100} cy={100} r={R} fill="none" stroke="var(--surface)" strokeWidth={26} />
          {shown.map((s, i) => {
            const seg = Math.max(0, lengths[i] - (shown.length > 1 ? GAP : 0));
            return (
              <circle
                key={s.label}
                cx={100}
                cy={100}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={26}
                strokeDasharray={`${seg} ${C - seg}`}
                strokeDashoffset={-starts[i]}
                className="donut-slice"
                style={{ "--seg": seg, "--rest": C - seg, animationDelay: `${i * 160}ms` } as CSSProperties}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center px-9 text-center">{center}</div>
      </div>
      <figcaption>
        <ul className="space-y-3">
          {shown.map((s) => (
            <li key={s.label} className="grid grid-cols-[1rem_4.5rem_1fr] items-baseline gap-x-3">
              <span className="h-3.5 w-3.5 translate-y-0.5 rounded-sm" style={{ background: s.color }} aria-hidden />
              <span className="font-display text-2xl font-bold tabular-nums">{total ? ((s.value / total) * 100).toFixed(1) : "0.0"}%</span>
              <span>
                <span className="block font-medium">{s.label}</span>
                {s.detail && <span className="block text-sm text-muted">{s.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
