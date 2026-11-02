import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db";
import { impactData, type MapPlace, type RescueRow } from "@/lib/impact-data";
import { Donut } from "@/components/donut";
import { CountUp, Reveal } from "@/components/motion";
import { PageArt } from "@/components/page-art";
import { Container, Kicker, Money, PageHeader } from "@/components/ui";
import { AskInsights } from "./ask-insights";
import { ImpactClient } from "./impact-client";
import { RescueMap } from "./rescue-map";

export const metadata = { title: "Impact" };

export default function ImpactPage() {
  return (
    <Container>
      <PageHeader
        art={<PageArt page="impact" />}
        kicker="Public impact"
        title="Every meal, every mile, every dollar."
        description="Live from MealBridge's own ledger and trip records. Nothing here is estimated by hand, and you can ask the Insights agent about any of it."
      />
      <Suspense
        fallback={
          <div className="space-y-8 py-10">
            <div className="h-28 animate-pulse rounded-2xl bg-surface" />
            <div className="h-[480px] animate-pulse rounded-2xl bg-surface" />
          </div>
        }
      >
        <ImpactData />
      </Suspense>
    </Container>
  );
}

function Totals({ delivered }: { delivered: RescueRow[] }) {
  const sum = (pick: (r: RescueRow) => number) => delivered.reduce((s, r) => s + pick(r), 0);
  const cells: [React.ReactNode, string][] = [
    [<CountUp key="m" value={sum((r) => r.meals)} />, "hot meals served"],
    [<CountUp key="p" value={Math.round(sum((r) => r.pounds))} />, "pounds of food kept out of landfill"],
    [<CountUp key="d" value={delivered.length} />, "deliveries by volunteer drivers"],
    [<CountUp key="r" value={Math.round(sum((r) => r.reimbursementUsd) * 100)} as="cents" />, "reimbursed through PayPal"],
  ];
  return (
    <dl className="grid grid-cols-2 lg:grid-cols-4">
      {cells.map(([value, label], i) => (
        <div key={label} className={`py-8 ${i % 2 ? "pl-6 sm:pl-10" : "pr-6"} ${i > 0 ? "border-line lg:border-l lg:pl-10" : ""} ${i === 1 || i === 3 ? "border-l" : ""} ${i > 1 ? "border-t lg:border-t-0" : ""}`}>
          <dt className="sr-only">{label}</dt>
          <dd>
            <span className="block font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{value}</span>
            <span className="mt-2 block text-sm text-muted">{label}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SectionHead({ id, kicker, title, children }: { id: string; kicker: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 max-w-2xl">
      <Kicker>{kicker}</Kicker>
      <h2 id={id} className="font-display text-3xl font-semibold tracking-[-0.03em]">
        {title}
      </h2>
      {children && <p className="mt-3 text-lg leading-relaxed text-muted">{children}</p>}
    </div>
  );
}

function AreaList({ delivered, places }: { delivered: RescueRow[]; places: MapPlace[] }) {
  const areas = ["San Francisco", "Oakland", "Berkeley"].map((area) => {
    const rows = delivered.filter((r) => r.area === area);
    return {
      area,
      meals: rows.reduce((s, r) => s + r.meals, 0),
      deliveries: rows.length,
      restaurants: places.filter((p) => p.kind === "restaurant" && p.area === area).length,
    };
  });
  const most = Math.max(1, ...areas.map((a) => a.meals));
  return (
    <ul className="divide-y divide-line border-y border-line">
      {areas.map((a) => (
        <li key={a.area} className="py-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-semibold">{a.area}</span>
            <span className="font-display text-2xl font-semibold">
              <CountUp value={a.meals} /> <span className="text-sm font-normal text-muted">meals</span>
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
            <div className="h-full rounded-full bg-brand" style={{ width: `${(a.meals / most) * 100}%` }} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {a.deliveries} {a.deliveries === 1 ? "delivery" : "deliveries"} from {a.restaurants} {a.restaurants === 1 ? "restaurant" : "restaurants"}
          </p>
        </li>
      ))}
    </ul>
  );
}

// Who paid each driver's reimbursement, in the order MealBridge reaches for the money.
const FUNDERS = [
  { label: "Restaurant plan", color: "#0d5a3b", detail: "The restaurant's own compliance plan, PayPal Subscriptions" },
  { label: "Area donors", color: "#1d5a9e", detail: "Gifts earmarked for that area, PayPal Checkout" },
  { label: "Sponsors and grants", color: "#d97a2b", detail: "Companies and city grants, PayPal Invoicing" },
  { label: "General fund", color: "#7fb59a", detail: "Covers whatever is left" },
];

function WhoPays({ delivered }: { delivered: RescueRow[] }) {
  const total = delivered.reduce((s, r) => s + r.reimbursementUsd, 0);
  const slices = FUNDERS.map((f) => ({ ...f, value: delivered.filter((r) => r.fundedBy === f.label).reduce((s, r) => s + r.reimbursementUsd, 0) }));
  return (
    <Donut
      title={`Who paid for the drives: ${slices.map((s) => `${s.label} ${total ? Math.round((s.value / total) * 100) : 0}%`).join(", ")}`}
      slices={slices}
      center={
        <span>
          <span className="block text-[11px] font-bold uppercase leading-tight tracking-[0.08em] text-muted">Paid to drivers</span>
          <span className="mt-1 block font-display text-[1.65rem] font-bold leading-none">
            <Money cents={Math.round(total * 100)} />
          </span>
          <span className="mt-1.5 block text-[11px] font-semibold leading-snug text-muted">$0 per pickup from restaurants</span>
        </span>
      }
    />
  );
}

async function ImpactData() {
  await connection();
  const { rescues, money, funds, places, routes } = await impactData(getDb());
  const delivered = rescues.filter((r) => r.outcome === "Delivered");
  return (
    <>
      <Totals delivered={delivered} />

      <section className="border-t border-line py-16 sm:py-20" aria-labelledby="where">
        <Reveal>
          <SectionHead id="where" kicker="Where the food travels" title="Kitchens to shelters, across the Bay.">
            Each line is a delivered rescue. Confidential shelters are shown at their neighbourhood, never their address.
          </SectionHead>
        </Reveal>
        <div className="grid items-start gap-10 lg:grid-cols-[1.6fr_1fr]">
          <RescueMap places={places} routes={routes} />
          <div className="space-y-5">
            <AreaList delivered={delivered} places={places} />
            <p className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-accent" aria-hidden /> Restaurant
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-brand" aria-hidden /> Shelter
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-0.5 w-5 rounded-full bg-brand" aria-hidden /> Delivery route
              </span>
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-line py-16 sm:py-20" aria-labelledby="who-pays">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.5fr]">
          <Reveal>
            <SectionHead id="who-pays" kicker="Who pays" title="Restaurants never pay per pickup.">
              Every drive is funded before a driver sets off, from the first source that can cover it. This is where the money for every delivered rescue came
              from.
            </SectionHead>
          </Reveal>
          <WhoPays delivered={delivered} />
        </div>
      </section>

      <section className="border-t border-line py-16 sm:py-20" aria-labelledby="trends">
        <Reveal>
          <SectionHead id="trends" kicker="Week by week" title="Meals out, money in, nothing wasted.">
            Pick an area to filter every chart, or click a bar or slice to drill in.
          </SectionHead>
        </Reveal>
        <ImpactClient rescues={rescues} money={money} funds={funds} />
      </section>

      <section className="border-t border-line py-16 sm:py-20" aria-labelledby="ask">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <SectionHead id="ask" kicker="Insights agent" title="Ask the numbers anything.">
            Gemini answers from the same ledger and trip records as this page, plus what&apos;s on the road tonight. It never makes up a figure.
          </SectionHead>
          <div className="rounded-2xl bg-surface p-5 sm:p-7">
            <AskInsights />
          </div>
        </div>
      </section>
    </>
  );
}
