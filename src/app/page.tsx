import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db";
import { tripViews } from "@/lib/queries";
import { Card, Money, Skeleton } from "@/components/ui";

const ROLES = [
  { href: "/restaurant", title: "Restaurant", body: "Snap tonight's surplus. Free, with SB 1383 records on the compliance plan." },
  { href: "/driver", title: "Volunteer driver", body: "Pick up, drop off, and get fuel reimbursed through PayPal or Venmo." },
  { href: "/shelter", title: "Shelter", body: "See what's coming and confirm it arrived." },
  { href: "/coordinator", title: "Coordinator", body: "Agents do the routine. Handle alerts and held deliveries." },
  { href: "/donate", title: "Donor", body: "Fund a rescue that's waiting, and see exactly where it went." },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="pt-4">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Tonight&apos;s surplus, <span className="text-leaf">tonight&apos;s meals.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Restaurants post leftover food with one photo. AI agents match it to a shelter that can use it, book a volunteer
          driver, check the delivery, and pay the driver through PayPal before they get home.
        </p>
      </section>

      <Suspense fallback={<Card><Skeleton lines={2} /></Card>}>
        <TonightStats />
      </Suspense>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ROLES.map((r) => (
          <Link key={r.href} href={r.href} className="rounded-2xl border border-line bg-paper p-4 hover:border-leaf">
            <p className="font-display text-lg font-semibold">{r.title} →</p>
            <p className="mt-1 text-sm text-muted">{r.body}</p>
          </Link>
        ))}
      </section>

      <p className="text-xs text-muted">
        Hackathon prototype. Payments use PayPal sandbox money; every business, shelter and person shown is fictional.
      </p>
    </div>
  );
}

async function TonightStats() {
  await connection();
  const trips = await tripViews(getDb(), { limit: 500 });
  const delivered = trips.filter((t) => t.trip.status === "paid" && t.trip.shelterAccepted);
  const stats = [
    { label: "Meals rescued", value: delivered.reduce((s, t) => s + t.listing.totalPortions, 0).toString() },
    { label: "Rescues in progress", value: trips.filter((t) => ["funded", "assigned", "picked_up", "delivered"].includes(t.trip.status)).length.toString() },
    { label: "Paid to drivers", value: <Money cents={trips.filter((t) => t.trip.status === "paid").reduce((s, t) => s + t.trip.stipendCents, 0)} /> },
  ];
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl bg-leaf-soft p-4">
          <p className="font-display text-3xl font-semibold text-leaf">{s.value}</p>
          <p className="text-sm text-muted">{s.label}</p>
        </div>
      ))}
    </section>
  );
}
