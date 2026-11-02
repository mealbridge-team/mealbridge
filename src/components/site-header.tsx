import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { aiMode } from "@/ai/model";
import { demoEveningActive } from "@/lib/clock";
import { paypalMode } from "@/paypal/client";
import { Logo } from "./brand";
import { MainNav } from "./main-nav";

export const ROLE_LINKS = [
  { href: "/restaurant", label: "Restaurants" },
  { href: "/driver", label: "Drivers" },
  { href: "/shelter", label: "Shelters" },
  { href: "/sponsor", label: "Sponsors" },
  { href: "/impact", label: "Impact" },
];

// One slim line that says this is a demo and how it's wired, so the product itself stays clean.
export function DemoStrip() {
  return (
    <div className="border-b border-line bg-surface text-[13px] text-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:px-6">
        <span className="font-semibold text-ink">Live demo</span>
        <Suspense fallback={null}>
          <Modes />
        </Suspense>
        <Link href="/coordinator" className="ml-auto font-medium text-ink underline-offset-4 hover:underline">
          Coordinator console
        </Link>
      </div>
    </div>
  );
}

async function Modes() {
  await connection();
  const parts = [
    paypalMode() === "sandbox" ? "PayPal sandbox" : "PayPal simulated",
    aiMode() === "gemini" ? "Gemini Flash-Lite" : "AI off, rules only",
  ];
  if (demoEveningActive()) parts.push("demo clock keeps shelters open");
  return <span className="hidden sm:inline">{parts.join(" · ")}</span>;
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-[1100] border-b border-line bg-bg/95 backdrop-blur supports-[backdrop-filter]:bg-bg/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Logo />
        <MainNav links={ROLE_LINKS} />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <Logo />
          <p className="text-sm leading-relaxed text-muted">
            Tonight&apos;s surplus restaurant food, to tonight&apos;s shelter meals. Volunteer drivers are reimbursed through PayPal before they get home.
          </p>
        </div>
        <FooterList title="Use MealBridge" links={ROLE_LINKS.slice(0, 4)} />
        <FooterList
          title="Organisation"
          links={[
            { href: "/impact", label: "Impact dashboard" },
            { href: "/donate", label: "Donate" },
            { href: "/coordinator", label: "Coordinator console" },
          ]}
        />
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted sm:px-6">
          Built for the PayPal AI Hackathon. Payments use PayPal sandbox money; every business, shelter and person shown is fictional.
        </p>
      </div>
    </footer>
  );
}

function FooterList({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <ul className="space-y-2 text-sm text-muted">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="hover:text-ink">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
