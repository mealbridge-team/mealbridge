"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { formatUsd } from "@/domain/stipend";

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Format = "number" | "cents";
const format = (n: number, kind: Format) => (kind === "cents" ? formatUsd(Math.round(n)) : Math.round(n).toLocaleString("en-US"));

/**
 * A number that counts up when it scrolls into view. The server renders the real value (so it's
 * right without JavaScript, for screen readers and for reduced motion); the browser then runs the
 * count once. Later changes (auto-refresh) count from the old value to the new one.
 */
export function CountUp({ value, as = "number", durationMs = 1400 }: { value: number; as?: Format; durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = shown.current ?? 0;
    if (prefersReducedMotion() || from === value) {
      shown.current = value;
      el.textContent = format(value, as);
      return;
    }
    el.textContent = format(from, as);
    let frame = 0;
    const run = () => {
      shown.current = value;
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = format(from + (value - from) * eased, as);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          run();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
      el.textContent = format(value, as);
    };
  }, [value, as, durationMs]);

  // Screen readers get the real value; the animated digits are for sighted readers only.
  return (
    <span className="tabular-nums">
      <span ref={ref} aria-hidden>
        {format(value, as)}
      </span>
      <span className="sr-only">{format(value, as)}</span>
    </span>
  );
}

/** Fades and lifts its content in the first time it scrolls into view. */
export function Reveal({ children, className = "", delayMs = 0, as: Tag = "div" }: { children: ReactNode; className?: string; delayMs?: number; as?: "div" | "li" | "section" }) {
  const ref = useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    // Already on screen at load: leave it alone rather than flash it.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    el.classList.add("reveal-pending");
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          el.style.transitionDelay = `${delayMs}ms`;
          el.classList.add("reveal-in");
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delayMs]);

  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}
