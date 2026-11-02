import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { ArrowRight, Building2, Car, HandHeart, Store } from "lucide-react";
import { getDb } from "@/db";
import { listings, matches, trips } from "@/db/schema";
import { daysAgo } from "@/lib/clock";
import { CountUp, Reveal } from "@/components/motion";
import { RescueCycle } from "@/components/rescue-cycle";
import { ShapeArt } from "@/components/shape-art";
import { buttonClass, Container, Kicker } from "@/components/ui";

const ROLES = [
  { href: "/restaurant", art: { src: "/cutouts/chef.webp", alt: "A chef holding out a stack of sealed meal containers", kind: "cutout", tones: ["saffron", "coral", "mint"] }, icon: Store, title: "Restaurants", body: "Post surplus in one photo. Posting is always free, and SB 1383 records are kept for you.", cta: "Post surplus food" },
  { href: "/driver", art: { src: "/cutouts/rider.webp", alt: "A volunteer rider with a delivery box on his bicycle", kind: "cutout", tones: ["mint", "saffron", "coral"] }, icon: Car, title: "Volunteer drivers", body: "One clear job at a time, the reimbursement shown up front, and paid before you're home.", cta: "Open the driver app" },
  { href: "/shelter", art: { src: "/cutouts/handoff.webp", alt: "A meal box being handed from one person to another", kind: "photo", tones: ["sky", "coral", "saffron"] }, icon: HandHeart, title: "Shelters and NGOs", body: "See food arriving live, tell us how much you can take tonight, confirm with one tap.", cta: "Open the shelter app" },
  { href: "/sponsor", art: { src: "/cutouts/sponsor.webp", alt: "A smiling man carrying a crate of bread, oranges and greens", kind: "cutout", tones: ["sky", "saffron", "mint"] }, icon: Building2, title: "Sponsors and city grants", body: "Fund rescues in your area, pay invoices through PayPal and see exactly what your money did.", cta: "Open the sponsor portal" },
] as const;

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
        <section className="grid items-end gap-x-12 gap-y-10 border-b border-line pt-12 sm:pt-16 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-7 lg:pb-16">
            <Kicker>Food rescue · San Francisco Bay Area</Kicker>
            <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Good food shouldn&apos;t end the night in the bin.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-muted">
              MealBridge moves tonight&apos;s restaurant surplus to tonight&apos;s shelter meals. AI agents find the shelter, book a volunteer driver and check the
              delivery. PayPal reimburses the driver before they get home.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/demo" className={`${buttonClass.primary} px-5`}>
                Try the demo <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/impact" className={`${buttonClass.secondary} px-5`}>
                See the impact
              </Link>
            </div>
          </div>
          <ShapeArt
            src="/cutouts/volunteers.webp"
            alt="Three volunteers in aprons laughing together, each carrying a box of food"
            tones={["mint", "coral", "saffron"]}
            priority
            sizes="(min-width: 1024px) 520px, 100vw"
            className="h-72 sm:h-[26rem] lg:h-[32rem]"
          />
        </section>
      </Container>

      <section className="border-b border-line" aria-label="Last 30 days">
        <Container>
          <Suspense fallback={<StatsBand />}>
            <LiveStats />
          </Suspense>
        </Container>
      </section>

      <Container>
        <section className="py-20 sm:py-28" aria-labelledby="how">
          <Reveal className="mx-auto max-w-2xl text-center">
            <Kicker>How it works</Kicker>
            <h2 id="how" className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              From the kitchen to the shelter in under an hour.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">
              Six steps, every night. People do the cooking, driving and serving; agents and PayPal handle everything in between.
            </p>
          </Reveal>
          <div className="mt-12 sm:mt-8">
            <RescueCycle />
          </div>
        </section>

        <section className="pb-20 sm:pb-28" aria-labelledby="who">
          <div className="max-w-2xl">
            <Kicker>Who it&apos;s for</Kicker>
            <h2 id="who" className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              One simple screen for everyone in the chain.
            </h2>
          </div>
          <ul className="mt-12 grid gap-x-8 gap-y-12 sm:grid-cols-2">
            {ROLES.map(({ href, art, icon: Icon, title, body, cta }, i) => (
              <Reveal as="li" key={href} delayMs={(i % 2) * 120}>
                <Link href={href} className="group block">
                  <div className="overflow-hidden rounded-2xl bg-surface px-6 pt-8">
                    <ShapeArt
                      {...art}
                      sizes="(min-width: 640px) 45vw, 90vw"
                      className="aspect-[3/2] transition-transform duration-700 ease-out group-hover:-translate-y-1"
                    />
                  </div>
                  <div className="mt-5 flex items-center gap-2.5">
                    <Icon className="h-5 w-5 text-brand" strokeWidth={1.75} aria-hidden />
                    <h3 className="font-display text-xl font-semibold tracking-[-0.02em]">{title}</h3>
                  </div>
                  <p className="mt-2 max-w-md leading-relaxed text-muted">{body}</p>
                  <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold">
                    {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden />
                  </span>
                </Link>
              </Reveal>
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
            {PRINCIPLES.map(([title, body], i) => (
              <Reveal key={title} delayMs={(i % 2) * 120}>
                <dt className="border-t border-ink pt-5 font-display text-lg font-semibold tracking-[-0.01em]">{title}</dt>
                <dd className="mt-2 leading-relaxed text-muted">{body}</dd>
              </Reveal>
            ))}
          </dl>
        </section>

        <Reveal as="section" className="grid overflow-hidden rounded-2xl bg-surface md:grid-cols-2">
          <div className="flex flex-col justify-center gap-6 p-8 sm:p-12">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">$5 covers a rescue trip&apos;s fuel.</h2>
              <p className="mt-2 text-muted">Fund a waiting pickup tonight and watch it happen on the impact dashboard.</p>
            </div>
            <Link href="/donate" className={`${buttonClass.donate} w-fit px-6`}>
              Donate
            </Link>
          </div>
          <ShapeArt
            src="/cutouts/mealbox.webp"
            alt="An open takeaway box of rice, curry and broccoli"
            kind="photo"
            tones={["coral", "mint", "saffron"]}
            sizes="(min-width: 768px) 380px, 80vw"
            className="h-72 md:h-auto md:min-h-80"
          />
        </Reveal>
      </Container>
    </>
  );
}

function StatsBand({ meals, rescues, paidCents, live }: { meals?: number; rescues?: number; paidCents?: number; live?: number }) {
  const cells: [React.ReactNode, string][] = [
    [meals != null ? <CountUp key="meals" value={meals} /> : "–", "meals rescued in the last 30 days"],
    [rescues != null ? <CountUp key="rescues" value={rescues} /> : "–", "deliveries verified"],
    [paidCents != null ? <CountUp key="paid" value={paidCents} as="cents" /> : "–", "reimbursed to volunteer drivers"],
    [live != null ? <CountUp key="live" value={live} /> : "–", "rescues on the road right now"],
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
