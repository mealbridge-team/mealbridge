import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { listings, matches, trips } from "@/db/schema";
import { daysAgo } from "@/lib/clock";
import { buttonClass, Money, Skeleton, Stat } from "@/components/ui";

const STEPS = [
  { title: "Snap", body: "A restaurant photographs tonight's leftovers. Gemini reads the dishes, portions and allergens; food-safety rules check the timing." },
  { title: "Match", body: "The Matcher picks a shelter that can use it tonight: diet rules, capacity, distance and opening hours." },
  { title: "Fund, then drive", body: "The Treasurer reserves the driver's fuel money before anyone is dispatched, so no volunteer ever drives unpaid." },
  { title: "Verify and pay", body: "Photo, GPS and the shelter's tap must agree. Then PayPal Payouts sends the reimbursement to PayPal or Venmo." },
];

const TRY = [
  { href: "/restaurant", role: "Restaurant", line: "Post tonight's surplus with one photo or a note.", start: true },
  { href: "/driver", role: "Volunteer driver", line: "Pick up, share your drive, drop off, get reimbursed." },
  { href: "/shelter", role: "Shelter", line: "See food arriving live, and tap when it's here." },
  { href: "/coordinator", role: "Coordinator", line: "Only the exceptions: reviews, funding gaps, sponsors." },
];

export default function Home() {
  return (
    <div className="space-y-16">
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-tomato">Food rescue, California Bay Area</p>
          <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight sm:text-6xl">
            Tonight&apos;s surplus,
            <br />
            <span className="text-leaf italic">tonight&apos;s meals.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            Restaurants post leftover food with one photo. AI agents find a shelter that can use it, book a volunteer driver, check
            the delivery, and reimburse the driver through PayPal before they get home.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/restaurant" className={`${buttonClass.primary} px-5 py-3 text-base`}>
              Run a rescue in 2 minutes →
            </Link>
            <Link href="/impact" className={`${buttonClass.secondary} px-5 py-3 text-base`}>
              See the impact
            </Link>
          </div>
        </div>
        <Suspense fallback={<div className="rounded-3xl border border-line bg-paper p-6"><Skeleton lines={4} /></div>}>
          <TonightPanel />
        </Suspense>
      </section>

      <section id="how">
        <h2 className="font-display text-3xl font-semibold tracking-tight">How a rescue works</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-3xl border border-line bg-paper p-5 shadow-card">
              <span className="font-display text-4xl font-semibold text-tomato/80">{i + 1}</span>
              <p className="mt-2 font-display text-lg font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-6 rounded-[2rem] bg-leaf p-8 text-white sm:p-10 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Restaurants never pay per pickup.</h2>
          <p className="mt-3 text-white/80">
            Binning food is free, so a fee at that moment works against donating. Every trip is funded before dispatch, from the
            first source that can cover it.
          </p>
        </div>
        <ol className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["Restaurant compliance plan", "PayPal Subscriptions, $25/month, with SB 1383 records"],
            ["Donors in that area", "PayPal Checkout, tied to the trip they fund"],
            ["Sponsors and city grants", "PayPal Invoicing, nudged by an agent"],
            ["General rescue fund", "Covers the gaps; unfunded trips wait for donors"],
          ].map(([title, body], i) => (
            <li key={title} className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs text-white/60">Source {i + 1}</p>
              <p className="font-semibold">{title}</p>
              <p className="text-white/75">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2 className="font-display text-3xl font-semibold tracking-tight">Try every side of it</h2>
        <p className="mt-2 text-muted">No sign-up. Start as the restaurant, then follow the food.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRY.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`group rounded-3xl border p-5 shadow-card transition hover:-translate-y-0.5 ${t.start ? "border-tomato bg-tomato-soft" : "border-line bg-paper"}`}
            >
              {t.start && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-tomato">Start here</p>}
              <p className="font-display text-xl font-semibold">{t.role} <span className="inline-block transition group-hover:translate-x-1">→</span></p>
              <p className="mt-1 text-sm text-muted">{t.line}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

async function TonightPanel() {
  await connection();
  const db = getDb();
  const since = daysAgo(30);
  const [month] = await db
    .select({
      meals: sql<string>`coalesce(sum(${listings.totalPortions}), 0)`,
      paid: sql<string>`coalesce(sum(${trips.stipendCents}), 0)`,
      rescues: sql<string>`count(*)`,
    })
    .from(trips)
    .innerJoin(matches, eq(matches.id, trips.matchId))
    .innerJoin(listings, eq(listings.id, matches.listingId))
    .where(and(eq(trips.status, "paid"), gte(trips.createdAt, since)));
  const [live] = await db
    .select({ n: sql<string>`count(*)` })
    .from(trips)
    .where(sql`${trips.status} in ('funded', 'assigned', 'picked_up', 'delivered')`);

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-line bg-paper p-7 shadow-card">
      <div aria-hidden className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-saffron-soft" />
      <div className="relative">
        <p className="text-sm font-semibold text-muted">Last 30 days</p>
        <div className="mt-4 grid grid-cols-2 gap-6">
          <Stat value={Number(month.meals).toLocaleString("en-US")} label="meals rescued" />
          <Stat value={Number(month.rescues)} label="deliveries verified" tone="ink" />
          <Stat value={<Money cents={Number(month.paid)} />} label="reimbursed to drivers" tone="ink" />
          <Stat value={Number(live.n)} label="rescues on the road now" tone="tomato" />
        </div>
        <Link href="/impact" className="mt-6 inline-block text-sm font-semibold text-leaf underline-offset-4 hover:underline">
          Open the live impact dashboard →
        </Link>
      </div>
    </div>
  );
}
