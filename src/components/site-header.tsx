import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { aiMode } from "@/ai/model";
import { demoEveningActive } from "@/lib/clock";
import { paypalMode } from "@/paypal/client";
import { NavLink } from "./nav-link";

const ROLES = [
  { href: "/restaurant", label: "Restaurant" },
  { href: "/driver", label: "Driver" },
  { href: "/shelter", label: "Shelter" },
  { href: "/coordinator", label: "Coordinator" },
];

// The demo switcher is kept apart from the product: real users only ever see their own screen.
export function DemoBar() {
  return (
    <div className="bg-ink text-cream">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-[0.14em] text-saffron-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-tomato" aria-hidden /> Demo
        </span>
        <nav aria-label="Try the app as" className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-cream/60">Try it as</span>
          {ROLES.map((r) => (
            <NavLink key={r.href} href={r.href} className="rounded-full px-2.5 py-1 text-cream/80 hover:bg-white/10 hover:text-white" activeClassName="bg-white/15 text-white">
              {r.label}
            </NavLink>
          ))}
        </nav>
        <Suspense fallback={null}>
          <ModeBadges />
        </Suspense>
      </div>
    </div>
  );
}

async function ModeBadges() {
  await connection();
  const badges = [
    paypalMode() === "sandbox" ? "PayPal sandbox" : "PayPal simulated",
    aiMode() === "gemini" ? "Gemini Flash" : "AI off: rules",
  ];
  if (demoEveningActive()) badges.push("Demo clock: shelters open");
  return (
    <div className="ml-auto flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span key={b} className="rounded-full border border-white/15 px-2 py-0.5 text-cream/75">
          {b}
        </span>
      ))}
    </div>
  );
}

export function SiteHeader() {
  return (
    <header className="border-b border-line/80 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-ink">
          <Logo />
          MealBridge
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <NavLink href="/impact" className="rounded-full px-3 py-1.5 text-muted hover:text-ink" activeClassName="text-ink font-semibold">
            Impact
          </NavLink>
          <NavLink href="/donate" className="rounded-full bg-tomato px-3.5 py-1.5 font-semibold text-white hover:brightness-110" activeClassName="">
            Donate
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="var(--leaf)" />
      <path d="M7 19c3-6 15-6 18 0" stroke="var(--paper)" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M9 19v4M23 19v4M16 13.5v9.5" stroke="var(--paper)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="16" cy="9.5" r="2.6" fill="var(--tomato)" />
    </svg>
  );
}
