import { Suspense } from "react";
import { connection } from "next/server";
import { ExternalLink } from "lucide-react";
import { getDb } from "@/db";
import { sponsors as sponsorsTable } from "@/db/schema";
import { sponsorSimulatePayment } from "@/app/actions";
import { sponsorOverview } from "@/services/sponsors";
import { AutoRefresh } from "@/components/auto-refresh";
import { CountUp } from "@/components/motion";
import { SubmitButton } from "@/components/submit-button";
import { AREA_LABEL, Badge, buttonClass, Container, dateLabel, Empty, Money, PageHeader, Panel, Skeleton, smallButton } from "@/components/ui";
import { PageArt } from "@/components/page-art";
import { personaId } from "@/lib/demo-session";
import { PortalSignIn } from "@/app/demo/people";
import { TopUpForm } from "./top-up-form";

export const metadata = { title: "For sponsors" };

export default function SponsorPage({ searchParams }: PageProps<"/sponsor">) {
  return (
    <Container>
      <Suspense
        fallback={
          <>
            <PageHeader art={<PageArt page="sponsor" />} kicker="For sponsors and city grants" title="Your rescue fund" />
            <div className="py-8">
              <Skeleton lines={6} />
            </div>
          </>
        }
      >
        <SponsorView searchParams={searchParams} />
      </Suspense>
    </Container>
  );
}

async function SponsorView({ searchParams }: { searchParams: PageProps<"/sponsor">["searchParams"] }) {
  await connection();
  const db = getDb();
  const sponsors = await db.select().from(sponsorsTable).orderBy(sponsorsTable.name);
  if (sponsors.length === 0) return <Empty>No sponsors yet. Run npm run setup to load the demo.</Empty>;

  const { sp } = await searchParams;
  // The coordinator console links here with ?sp=; otherwise it's whoever is signed in.
  const signedIn = typeof sp === "string" ? sp : await personaId("sponsor");
  const chosen = sponsors.find((x) => x.id === signedIn);
  if (!chosen)
    return <PortalSignIn role="sponsor" header={<PageHeader art={<PageArt page="sponsor" />} kicker="For sponsors and city grants" title="Sign in to your fund" description="Choose a sponsor to see their fund, invoices and the rescues they paid for." />} />;
  const overview = await sponsorOverview(db, chosen.id);
  if (!overview) return <Empty>That sponsor no longer exists.</Empty>;
  const { sponsor, availableCents, areas, rescues, meals, spentCents, recent, invoices } = overview;
  const unpaid = invoices.filter((i) => i.status === "sent");

  return (
    <>
      <PageHeader art={<PageArt page="sponsor" />}
        kicker={sponsor.kind === "city" ? "City food-recovery grant" : "Corporate sponsor"}
        title={sponsor.name}
        description={`Your fund pays volunteer drivers' fuel for rescues${areas.length ? ` in ${areas.map((a) => AREA_LABEL[a]).join(" and ")}` : " anywhere in the Bay Area"}. Every dollar goes to a delivery you can see.`}
       />

      <div className="space-y-6 py-8">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
          {[
            [<CountUp key="a" value={availableCents} as="cents" />, "available in your fund"],
            [<CountUp key="r" value={rescues} />, "rescues funded"],
            [<CountUp key="m" value={meals} />, "meals in those rescues"],
            [<CountUp key="s" value={spentCents} as="cents" />, "paid to volunteer drivers"],
          ].map(([value, label]) => (
            <div key={String(label)} className="bg-bg p-5 sm:p-6">
              <dt className="sr-only">{label}</dt>
              <dd>
                <span className="block font-display text-3xl font-semibold tabular-nums tracking-[-0.03em]">{value}</span>
                <span className="mt-1 block text-sm text-muted">{label}</span>
              </dd>
            </div>
          ))}
        </dl>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.3fr]">
          <Panel title="Top up your fund" description="We create a PayPal invoice for you to pay straight away. When it's paid, waiting rescues are funded automatically.">
            <TopUpForm sponsorId={sponsor.id} />
          </Panel>

          <Panel title="Invoices" action={unpaid.length > 0 ? <Badge tone="warn">{unpaid.length} to pay</Badge> : <Badge tone="ok">All paid</Badge>}>
            {invoices.length === 0 ? (
              <Empty>No invoices yet.</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {invoices.slice(0, 8).map((invoice) => (
                  <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        <Money cents={invoice.amountCents} /> <span className="font-normal text-muted">· {invoice.invoiceNumber}</span>
                      </p>
                      <p className="truncate text-xs text-muted">
                        {dateLabel(invoice.createdAt)} · {invoice.memo}
                      </p>
                    </div>
                    {invoice.status === "sent" ? (
                      invoice.payerViewUrl ? (
                        <a href={invoice.payerViewUrl} target="_blank" rel="noreferrer" className={`${buttonClass.paypal} ${smallButton}`}>
                          Pay with PayPal <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        </a>
                      ) : invoice.paypalInvoiceId.startsWith("MOCK-") ? (
                        <form action={sponsorSimulatePayment.bind(null, invoice.id)}>
                          <SubmitButton variant="secondary" pendingText="…" className={smallButton}>
                            Pay (simulated)
                          </SubmitButton>
                        </form>
                      ) : (
                        <Badge tone="warn">Unpaid</Badge>
                      )
                    ) : (
                      <Badge tone={invoice.status === "paid" ? "ok" : "neutral"}>{invoice.status === "paid" ? `Paid ${dateLabel(invoice.paidAt)}` : "Cancelled"}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {unpaid.length > 0 && <p className="mt-4 text-xs text-muted">Payments show here within a couple of minutes of paying in PayPal.</p>}
          </Panel>
        </div>

        <Panel title="What your money did" description="The most recent rescues your fund paid for.">
          {recent.length === 0 ? (
            <Empty>Once a rescue draws on your fund, it shows here.</Empty>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {recent.map((r) => (
                <li key={r.tripId} className="flex items-baseline justify-between gap-4 py-3">
                  <span className="min-w-0">
                    <span className="block">
                      {r.portions} portions from {r.restaurant}
                    </span>
                    <span className="block text-xs text-muted">
                      {dateLabel(r.paidAt)} · {AREA_LABEL[r.area]}
                    </span>
                  </span>
                  <Money cents={r.amountCents} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      {unpaid.length > 0 && <AutoRefresh everyMs={20_000} />}
    </>
  );
}
