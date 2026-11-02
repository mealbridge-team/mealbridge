import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ChevronDown } from "lucide-react";
import { aiMode } from "@/ai/model";
import { signOut } from "@/app/actions";
import { getDb } from "@/db";
import { demoEveningActive } from "@/lib/clock";
import { getPersona, personaName, PORTAL, ROLE_LABEL } from "@/lib/demo-session";
import { paypalMode } from "@/paypal/client";
import { Logo } from "./brand";
import { DeliveryScene } from "./delivery-scene";
import { MainNav } from "./main-nav";
import { buttonClass } from "./ui";

// The public site is small: how it works, the impact, and giving. Each portal (restaurant, driver,
// shelter, sponsor) is reached by signing in, so it isn't in the menu.
const NAV_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/impact", label: "Impact" },
];

const PORTAL_LINKS = [
  { href: "/restaurant", label: "Restaurants" },
  { href: "/driver", label: "Volunteer drivers" },
  { href: "/shelter", label: "Shelters and NGOs" },
  { href: "/sponsor", label: "Sponsors" },
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
        <MainNav
          links={NAV_LINKS}
          account={
            <Suspense fallback={<SignInLink />}>
              <Account />
            </Suspense>
          }
        />
      </div>
    </header>
  );
}

function SignInLink() {
  return (
    <Link href="/demo" className={`${buttonClass.secondary} min-h-10`}>
      Try the demo
    </Link>
  );
}

// Who you're signed in as (demo persona), with the way to your own page, to switch, or to leave.
async function Account() {
  await connection();
  const persona = await getPersona();
  const name = persona && (await personaName(getDb(), persona));
  if (!persona || !name) return <SignInLink />;
  return (
    <details className="group relative">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-bg py-1 pl-1 pr-3 hover:border-ink [&::-webkit-details-marker]:hidden">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand text-sm font-semibold text-on-brand" aria-hidden>
          {name.slice(0, 1)}
        </span>
        <span className="max-w-[9rem] truncate text-sm font-semibold">{name}</span>
        <ChevronDown className="h-4 w-4 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="absolute right-0 z-[1200] mt-2 w-64 rounded-xl border border-line bg-bg p-1.5 shadow-lg">
        <p className="px-3 pb-2 pt-1.5 text-xs text-muted">
          Signed in as a {ROLE_LABEL[persona.role].toLowerCase()} (demo)
        </p>
        <Link href={PORTAL[persona.role]} className="flex min-h-10 items-center rounded-lg px-3 text-sm font-semibold hover:bg-surface">
          Open my page
        </Link>
        <Link href="/demo" className="flex min-h-10 items-center rounded-lg px-3 text-sm hover:bg-surface">
          Switch person
        </Link>
        <form action={signOut}>
          <button type="submit" className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm text-muted hover:bg-surface hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <DeliveryScene />
      </div>
      <div className="border-t border-line" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <Logo />
          <p className="text-sm leading-relaxed text-muted">
            Tonight&apos;s surplus restaurant food, to tonight&apos;s shelter meals. Volunteer drivers are reimbursed through PayPal before they get home.
          </p>
        </div>
        <FooterList title="Portals" links={PORTAL_LINKS} />
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
