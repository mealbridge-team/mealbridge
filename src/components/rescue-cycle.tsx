"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Car, HandHeart, type LucideIcon, Sparkles, Store, Wallet } from "lucide-react";

type Stage = { icon: LucideIcon; title: string; caption: [string, string]; money?: boolean };

// Clockwise from the top: one rescue, end to end. Money stages are tinted to stand apart.
const STAGES: Stage[] = [
  { icon: Store, title: "Restaurant posts", caption: ["One photo or a note,", "always free"] },
  { icon: Sparkles, title: "Agents match", caption: ["Gemini reads it; rules", "check safety and fit"] },
  { icon: Wallet, title: "Trip is funded", caption: ["Plan, donors or sponsors", "via PayPal, before dispatch"], money: true },
  { icon: Car, title: "Driver delivers", caption: ["Live ETA for the", "shelter on the way"] },
  { icon: HandHeart, title: "Shelter confirms", caption: ["One tap when the food", "is in the kitchen"] },
  { icon: BadgeCheck, title: "Driver is paid", caption: ["PayPal Payouts, before", "they get home"], money: true },
];

const W = 760;
const H = 700;
const CX = W / 2;
const CY = 340;
const R = 240;
const NODE = 50;
const RING = `M ${CX} ${CY - R} A ${R} ${R} 0 1 1 ${CX - 0.01} ${CY - R} Z`;

export function RescueCycle() {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setVisible(true);
        if (!reduced) window.setTimeout(() => setMoving(true), 1400);
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const points = STAGES.map((_, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return { x: CX + R * Math.cos(a), y: CY + R * Math.sin(a), a };
  });

  return (
    <div ref={box} className={`rescue-cycle ${visible ? "is-visible" : ""}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto hidden w-full max-w-3xl sm:block" role="img" aria-labelledby="cycle-title cycle-desc">
        <title id="cycle-title">How one rescue moves through MealBridge</title>
        <desc id="cycle-desc">{STAGES.map((s, i) => `${i + 1}. ${s.title}: ${s.caption.join(" ")}`).join(" ")}</desc>

        <path d={RING} pathLength={1} className="rc-ring" fill="none" stroke="var(--line)" strokeWidth={2} />
        <path d={RING} pathLength={1} className="rc-ring rc-ring-ink" fill="none" stroke="var(--brand)" strokeWidth={2} strokeOpacity={0.45} />

        {points.map((p, i) => {
          const inner = 104;
          const outer = R - NODE - 18;
          return (
            <line
              key={`spoke-${i}`}
              x1={CX + inner * Math.cos(p.a)}
              y1={CY + inner * Math.sin(p.a)}
              x2={CX + outer * Math.cos(p.a)}
              y2={CY + outer * Math.sin(p.a)}
              className="rc-spoke"
              stroke="var(--muted)"
              strokeOpacity={0.35}
              strokeWidth={1.5}
              strokeDasharray="2 6"
              strokeLinecap="round"
            />
          );
        })}

        {moving &&
          [0, 3].map((offset) => (
            <circle key={offset} r={6} fill="var(--accent)">
              <animateMotion dur="12s" repeatCount="indefinite" path={RING} begin={`${-offset * 2}s`} />
            </circle>
          ))}

        <g className="rc-center">
          <circle cx={CX} cy={CY} r={88} fill="var(--brand)" />
          <path
            d={`M ${CX - 30} ${CY + 18} V ${CY - 4} a 15 15 0 0 1 30 0 V ${CY + 18} M ${CX} ${CY - 4} a 15 15 0 0 1 30 0 V ${CY + 18}`}
            fill="none"
            stroke="var(--on-brand)"
            strokeWidth={9}
            strokeLinejoin="round"
          />
          <text x={CX} y={CY + 50} textAnchor="middle" fill="var(--on-brand)" fontSize={14} fontWeight={600} opacity={0.85}>
            under an hour
          </text>
        </g>

        {STAGES.map((s, i) => {
          const p = points[i];
          const Icon = s.icon;
          return (
            <g key={s.title} className="rc-node" style={{ transitionDelay: `${300 + i * 140}ms` }}>
              <circle cx={p.x} cy={p.y} r={NODE} fill={s.money ? "var(--accent-soft)" : "var(--brand-soft)"} />
              <Icon x={p.x - 18} y={p.y - 18} width={36} height={36} color={s.money ? "var(--accent)" : "var(--brand)"} strokeWidth={1.75} aria-hidden />
              <text x={p.x} y={p.y + NODE + 24} textAnchor="middle" fill="var(--ink)" fontSize={16} fontWeight={600}>
                {s.title}
              </text>
              {s.caption.map((line, j) => (
                <text key={j} x={p.x} y={p.y + NODE + 44 + j * 17} textAnchor="middle" fill="var(--muted)" fontSize={13}>
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </svg>

      {/* Small screens: the same loop as a list, since diagram text would be too small to read. */}
      <ol className="space-y-4 sm:hidden">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.title} className="flex gap-4">
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${s.money ? "bg-accent-soft text-accent" : "bg-brand-soft text-brand"}`}>
                <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">
                  {i + 1}. {s.title}
                </span>
                <span className="block text-sm text-muted">{s.caption.join(" ")}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
