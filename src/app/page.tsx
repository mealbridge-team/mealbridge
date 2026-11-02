import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { ArrowRight, Building2, Car, HandHeart, Store } from "lucide-react";
import { getDb } from "@/db";
import { listings, matches, trips } from "@/db/schema";
import { daysAgo } from "@/lib/clock";
import { buttonClass, Container, Kicker, Money } from "@/components/ui";

const STEPS = [
  { title: "Snap", body: "A restaurant photographs tonight's leftovers. Gemini reads the dishes, portions and allergens; plain-code rules check food safety." },
  { title: "Match", body: "The shelter that can use it tonight is chosen by diet rules, capacity, distance and opening hours." },
  { title: "Fund, then drive", body: "The driver's fuel money is reserved before anyone is dispatched. No volunteer ever drives unpaid." },
  { title: "Verify and pay", body: "Photo, GPS and the shelter's tap must agree. Then PayPal Payouts reimburses the driver, to PayPal or Venmo." },
];

const ROLES = [
  { href: "/restaurant", icon: Store, title: "Restaurants", body: "Post surplus in one photo. Posting is always free, and SB 1383 records are kept for you.", cta: "Post surplus food" },
  { href: "/driver", icon: Car, title: "Volunteer drivers", body: "One clear job at a time, the reimbursement shown up front, and paid before you're home.", cta: "Open the driver app" },
  { href: "/shelter", icon: HandHeart, title: "Shelters and NGOs", body: "See food arriving live, tell us how much you can take tonight, confirm with one tap.", cta: "Open the shelter app" },
  { href: "/sponsor", icon: Building2, title: "Sponsors and city grants", body: "Fund rescues in your area, pay invoices through PayPal and see exactly what your money did.", cta: "Open the sponsor portal" },
];

const FUNDING = [
  ["The restaurant's compliance plan", "PayPal Subscriptions, $25 a month"],
  ["Donors in that area", "PayPal Checkout, tied to a waiting trip"],
  ["Sponsors and city grants", "PayPal Invoicing, nudged by an agent"],
  ["The general rescue fund", "Covers the gaps"],
];

const PRINCIPLES = [
  ["Rules decide safety and money.", "AI reads photos and explains choices. Whether food is safe, and whether a driver is paid, is decided by tested code."],
  ["Nobody drives for free.", "Every trip is funded before dispatch, and the reimbursement goes out the moment a delivery is verified."],
  ["Shelters stay private.", "Confidential shelters never appear exactly on a public map; drivers see the address only once food is on board."],
  ["Every dollar is public.", "Each meal, mile and payment is on the impact dashboard, straight from the ledger."],
];

export default function Home() {
  return (
    <>
      <Container>
        <section className="grid gap-12 pb-16 pt-16 sm:pt-24 lg:grid-cols-[1.35fr_1fr] lg:items-end">
          <div>
            <Kicker>Food rescue · San Francisco Bay Area</Kicker>
            <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-7xl">
              Good food shouldn&apos;t end the night in the bin.
            </h1>
          </div>
          <div className="space-y-7 lg:pb-2">
            <p className="text-lg leading-relaxed text-muted">
              MealBridge moves tonight&apos;s restaurant surplus to tonight&apos;s shelter meals. AI agents find the shelter, book a volunteer driver and check the
              delivery. PayPal reimburses the driver before they get home.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/restaurant" className={`${buttonClass.primary} px-5`}>
                Run a rescue <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/impact" className={`${buttonClass.secondary} px-5`}>
                See the impact
              </Link>
            </div>
          </div>
        </section>
      </Container>

      <section className="border-y border-line" aria-label="Last 30 days">
        <Container>
          <Suspense fallback={<StatsBand />}>
            <LiveStats />
          </Suspense>
        </Container>
      </section>

      <Container>
        <section className="py-20 sm:py-28" aria-labelledby="how">
          <div className="max-w-2xl">
            <Kicker>How it works</Kicker>
            <h2 id="how" className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              From the kitchen to the shelter in under an hour.
            </h2>
          </div>
          <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-t border-ink pt-5">
                <p className="font-display text-sm font-semibold tabular-nums text-muted">0{i + 1}</p>
                <h3 className="mt-3 font-display text-xl font-semibold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="pb-20 sm:pb-28" aria-labelledby="who">
          <div className="max-w-2xl">
            <Kicker>Who it&apos;s for</Kicker>
            <h2 id="who" className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              One simple screen for everyone in the chain.
            </h2>
          </div>
          <ul className="mt-12 grid border-t border-line sm:grid-cols-2">
            {ROLES.map(({ href, icon: Icon, title, body, cta }) => (
              <li key={href} className="border-b border-line sm:odd:border-r sm:odd:pr-10 sm:even:pl-10">
                <Link href={href} className="group flex h-full flex-col gap-3 py-8">
                  <Icon className="h-6 w-6 text-brand" strokeWidth={1.75} aria-hidden />
                  <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">{title}</h3>
                  <p className="max-w-md leading-relaxed text-muted">{body}</p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-semibold">
                    {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </Container>

      <section className="bg-brand text-on-brand" aria-labelledby="money">
        <Container>
          <div className="grid gap-12 py-20 sm:py-24 lg:grid-cols-[1fr_1.2fr]">
            <div>
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] opacity-75">The money</p>
              <h2 id="money" className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                Restaurants never pay per pickup.
              </h2>
              <p className="mt-5 max-w-md text-lg leading-relaxed opacity-80">
                Binning food is free, so a fee at that moment works against donating. Every trip is funded before dispatch, from the first source that can cover it.
              </p>
            </div>
            <ol className="divide-y divide-current/20 border-y border-current/20">
              {FUNDING.map(([title, body], i) => (
                <li key={title} className="grid grid-cols-[2.5rem_1fr] gap-2 py-5">
                  <span className="font-display font-semibold tabular-nums opacity-60">{i + 1}</span>
                  <span>
                    <span className="block font-semibold">{title}</span>
                    <span className="block text-sm opacity-75">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      <Container>
        <section className="py-20 sm:py-28" aria-labelledby="principles">
          <div className="max-w-2xl">
            <Kicker>What we hold to</Kicker>
            <h2 id="principles" className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Agents for the messy parts. Plain code for the parts people trust.
            </h2>
          </div>
          <dl className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {PRINCIPLES.map(([title, body]) => (
              <div key={title}>
                <dt className="font-display text-lg font-semibold tracking-[-0.01em]">{title}</dt>
                <dd className="mt-2 leading-relaxed text-muted">{body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-surface p-8 sm:flex-row sm:items-center sm:p-12">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">$5 covers a rescue trip&apos;s fuel.</h2>
            <p className="mt-2 text-muted">Fund a waiting pickup tonight and watch it happen on the impact dashboard.</p>
          </div>
          <Link href="/donate" className={`${buttonClass.donate} px-6`}>
            Donate
          </Link>
        </section>
      </Container>
    </>
  );
}

function StatsBand({ meals, rescues, paidCents, live }: { meals?: number; rescues?: number; paidCents?: number; live?: number }) {
  const cells: [React.ReactNode, string][] = [
    [meals?.toLocaleString("en-US") ?? "–", "meals rescued in the last 30 days"],
    [rescues ?? "–", "deliveries verified"],
    [paidCents != null ? <Money key="m" cents={paidCents} /> : "–", "reimbursed to volunteer drivers"],
    [live ?? "–", "rescues on the road right now"],
  ];
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4">
      {cells.map(([value, label], i) => (
        <div key={label} className={`py-10 ${i % 2 ? "pl-6 sm:pl-10" : "pr-6"} ${i > 0 ? "border-line lg:border-l lg:pl-10" : ""} ${i === 1 ? "border-l" : ""} ${i === 3 ? "border-l" : ""} ${i > 1 ? "border-t lg:border-t-0" : ""}`}>
          <dt className="sr-only">{label}</dt>
          <dd>
            <span className="block font-display text-4xl font-semibold tabular-nums tracking-[-0.03em] sm:text-5xl">{value}</span>
            <span className="mt-2 block text-sm text-muted">{label}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

async function LiveStats() {
  await connection();
  const db = getDb();
  const [month] = await db
    .select({
      meals: sql<string>`coalesce(sum(${listings.totalPortions}), 0)`,
      paid: sql<string>`coalesce(sum(${trips.stipendCents}), 0)`,
      rescues: sql<string>`count(*)`,
    })
    .from(trips)
    .innerJoin(matches, eq(matches.id, trips.matchId))
    .innerJoin(listings, eq(listings.id, matches.listingId))
    .where(and(eq(trips.status, "paid"), gte(trips.createdAt, daysAgo(30))));
  const [live] = await db
    .select({ n: sql<string>`count(*)` })
    .from(trips)
    .where(sql`${trips.status} in ('funded', 'assigned', 'picked_up', 'delivered')`);
  return <StatsBand meals={Number(month.meals)} rescues={Number(month.rescues)} paidCents={Number(month.paid)} live={Number(live.n)} />;
}
