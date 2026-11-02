import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, ExternalLink, RefreshCw } from "lucide-react";
import { getDb } from "@/db";
import { sponsors as sponsorsTable } from "@/db/schema";
import {
  coordinatorApprove,
  coordinatorCancel,
  coordinatorDismissAlert,
  coordinatorReassign,
  coordinatorRetryPayout,
  coordinatorSimulateInvoice,
  resetDemo,
  syncPayPalNow,
} from "@/app/actions";
import { openAlerts, tripViews, type TripView } from "@/lib/queries";
import { poolBalances } from "@/services/treasury";
import { invoiceViews } from "@/services/invoices";
import { formatUsd } from "@/domain/stipend";
import { isCoordinator } from "@/lib/access";
import { isTonight } from "@/lib/clock";
import { AutoRefresh } from "@/components/auto-refresh";
import { LiveMap } from "@/components/live-map";
import { SubmitButton } from "@/components/submit-button";
import { AREA_LABEL, Badge, Container, Empty, Money, PageHeader, Panel, RescueSteps, Skeleton, smallButton, TripStatusBadge, timeLabel, type Tone } from "@/components/ui";
import { InvoiceForm } from "./invoice-form";
import { ReminderForm } from "./reminder-form";
import { UnlockForm } from "./unlock-form";

export const metadata = { title: "Coordinator console" };

export default function CoordinatorPage() {
  return (
    <Container>
      <Suspense
        fallback={
          <>
            <PageHeader kicker="Operations" title="Coordinator console" />
            <div className="py-8">
              <Skeleton lines={8} />
            </div>
          </>
        }
      >
        <CoordinatorView />
      </Suspense>
      <AutoRefresh everyMs={15_000} />
    </Container>
  );
}

const ALERT_LABEL: Record<string, { label: string; tone: Tone }> = {
  unfunded_trip: { label: "Needs funding", tone: "warn" },
  low_fund: { label: "Fund running low", tone: "warn" },
  late_driver: { label: "No driver free", tone: "warn" },
  verification_failed: { label: "Check delivery", tone: "bad" },
  unsafe_listing: { label: "Food safety", tone: "warn" },
  payout_failed: { label: "Payout failed", tone: "bad" },
  payout_unclaimed: { label: "Payout unclaimed", tone: "warn" },
};

async function CoordinatorView() {
  await connection();
  const db = getDb();
  const [alerts, trips, pools, invoices, sponsors] = await Promise.all([
    openAlerts(db),
    tripViews(db, { limit: 60 }),
    poolBalances(db),
    invoiceViews(db),
    db.select().from(sponsorsTable).orderBy(sponsorsTable.name),
  ]);
  const canAct = await isCoordinator();
  const tonight = trips.filter((t) => isTonight(t.trip.createdAt));
  const review = tonight.filter((t) => t.trip.status === "needs_review");
  const stuckPayouts = tonight.filter((t) => t.trip.status === "verified");
  const unfunded = tonight.filter((t) => t.trip.status === "unfunded");
  const openInvoices = invoices.filter((i) => i.invoice.status === "sent");
  // An alert about a trip that's already in the queue would say the same thing twice.
  const queuedTrips = new Set([...review, ...stuckPayouts, ...unfunded].map((t) => t.trip.id));
  const otherAlerts = alerts.filter((a) => !a.tripId || !queuedTrips.has(a.tripId));
  const queueSize = review.length + stuckPayouts.length + unfunded.length + otherAlerts.length;

  return (
    <>
      <PageHeader
        kicker="Operations"
        title="Coordinator console"
        description="The agents match, fund, dispatch and pay on their own. You only see what needs a person."
      >
        {canAct ? <Badge tone="ok">Unlocked</Badge> : <UnlockForm />}
      </PageHeader>
      {!canAct && (
        <p className="pt-4 text-sm text-muted">
          You can watch everything. Approving payouts, re-planning trips, invoicing sponsors and resetting the demo need the passcode (judges: it&apos;s in our Devpost
          submission).
        </p>
      )}

      <div className="space-y-6 py-8">
        <Panel title="Needs you now" action={<Badge tone={queueSize ? "warn" : "ok"}>{queueSize ? `${queueSize} open` : "All clear"}</Badge>}>
          {queueSize === 0 ? (
            <Empty>Nothing needs a person right now.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {review.map((t) => (
                <QueueItem
                  key={t.trip.id}
                  tone="bad"
                  tag="Check delivery"
                  title={`${t.restaurant.name} → ${t.shelter.name}`}
                  body={t.trip.verification?.notes.filter((n) => !n.startsWith("Demo mode")).join(" ") || "The signals don't agree."}
                  note={t.trip.verification?.notes.some((n) => n.startsWith("Demo mode")) ? "Simulated drive" : undefined}
                >
                  {canAct && (
                    <form action={coordinatorApprove.bind(null, t.trip.id)}>
                      <SubmitButton pendingText="Paying…" className={smallButton}>
                        Approve and pay <Money cents={t.trip.stipendCents} />
                      </SubmitButton>
                    </form>
                  )}
                </QueueItem>
              ))}
              {stuckPayouts.map((t) => (
                <QueueItem key={t.trip.id} tone="bad" tag="Payout didn't go through" title={`${t.driver?.name ?? "Driver"} · ${t.restaurant.name} → ${t.shelter.publicLabel}`} body="Verified, but PayPal hasn't accepted the payout yet.">
                  {canAct && (
                    <form action={coordinatorRetryPayout.bind(null, t.trip.id)}>
                      <SubmitButton pendingText="Paying…" className={smallButton}>
                        Retry payout
                      </SubmitButton>
                    </form>
                  )}
                </QueueItem>
              ))}
              {unfunded.map((t) => (
                <QueueItem
                  key={t.trip.id}
                  tone="warn"
                  tag="Waiting for funding"
                  title={`${t.listing.totalPortions} portions in ${AREA_LABEL[t.restaurant.area]}`}
                  body={`Needs ${formatUsd(t.trip.stipendCents)} before a driver can go. Donors see it on the Donate page.`}
                >
                  <Link href={`/donate?trip=${t.trip.id}`} className="inline-flex items-center gap-1 text-sm font-semibold underline-offset-4 hover:underline">
                    Its donation page <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </QueueItem>
              ))}
              {otherAlerts.map((a) => {
                const meta = ALERT_LABEL[a.kind] ?? { label: a.kind, tone: "neutral" as Tone };
                return (
                  <QueueItem key={a.id} tone={meta.tone} tag={meta.label} title={timeLabel(a.createdAt)} body={a.message}>
                    {canAct && (
                      <form action={coordinatorDismissAlert.bind(null, a.id)}>
                        <SubmitButton variant="secondary" pendingText="…" className={smallButton}>
                          Dismiss
                        </SubmitButton>
                      </form>
                    )}
                  </QueueItem>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="grid items-start gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Panel title="On the road">
            <LiveMap height={340} />
          </Panel>
          <Panel title="Rescue funds" description="Synced with PayPal every two minutes.">
            <ul className="divide-y divide-line text-sm">
              {pools.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    {p.label}
                    {p.area && <span className="text-muted"> · {AREA_LABEL[p.area]}</span>}
                  </span>
                  <span className={`font-medium ${p.availableCents < 500 ? "text-warn" : ""}`}>
                    <Money cents={p.availableCents} />
                  </span>
                </li>
              ))}
            </ul>
            <form action={syncPayPalNow} className="mt-4">
              <SubmitButton variant="secondary" pendingText="Asking PayPal…" className="w-full">
                <RefreshCw className="h-4 w-4" aria-hidden /> Sync with PayPal now
              </SubmitButton>
            </form>
          </Panel>
        </div>

        <Panel
          title="Sponsors and city grants"
          description="Bill a sponsor with a PayPal invoice. Paid invoices land in their fund and fund waiting trips automatically. Sponsors can also top up from their own portal."
          action={<Badge tone={openInvoices.length ? "warn" : "ok"}>{openInvoices.length} unpaid</Badge>}
        >
          <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
            <div>{canAct ? <InvoiceForm sponsors={sponsors.map((s) => ({ id: s.id, name: s.name }))} /> : <Empty>Unlock to send invoices.</Empty>}</div>
            {invoices.length === 0 ? (
              <Empty>No invoices yet.</Empty>
            ) : (
              <ul className="divide-y divide-line border-t border-line lg:border-t-0">
                {invoices.slice(0, 6).map(({ invoice, sponsor }) => (
                  <li key={invoice.id} className="space-y-2 py-3 lg:first:pt-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link href={`/sponsor?sp=${sponsor.id}`} className="text-sm font-semibold underline-offset-4 hover:underline">
                        {sponsor.name}
                      </Link>
                      <span className="flex items-center gap-2 text-sm">
                        <Money cents={invoice.amountCents} />
                        <Badge tone={invoice.status === "paid" ? "ok" : invoice.status === "sent" ? "warn" : "neutral"}>{invoice.status === "sent" ? "Unpaid" : invoice.status === "paid" ? "Paid" : "Cancelled"}</Badge>
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {invoice.invoiceNumber} · {invoice.memo}
                      {invoice.payerViewUrl && (
                        <>
                          {" · "}
                          <a href={invoice.payerViewUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-ink underline underline-offset-2">
                            PayPal <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        </>
                      )}
                    </p>
                    {invoice.status === "sent" && canAct && (
                      <div className="flex flex-wrap items-start gap-2">
                        <ReminderForm invoiceId={invoice.id} />
                        {invoice.paypalInvoiceId.startsWith("MOCK-") && (
                          <form action={coordinatorSimulateInvoice.bind(null, invoice.id)}>
                            <SubmitButton variant="secondary" pendingText="…" className={smallButton}>
                              Simulate payment
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Tonight's rescues" action={<span className="text-sm text-muted">{tonight.length} in the last 14 hours</span>}>
          {tonight.length === 0 ? (
            <Empty>No rescues yet tonight. Post food from the Restaurants page to start one.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {tonight.map((t) => (
                <TripRow key={t.trip.id} t={t} canAct={canAct} />
              ))}
            </ul>
          )}
        </Panel>

        {canAct && (
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-dashed border-line p-5">
            <div>
              <p className="text-sm font-semibold">Demo tools</p>
              <p className="text-sm text-muted">Reload six weeks of history and a fresh evening. Clears tonight&apos;s test rescues.</p>
            </div>
            <form action={resetDemo}>
              <SubmitButton variant="danger" pendingText="Resetting…" confirm="Reset all demo data? Tonight's test rescues, payments and invoices will be cleared.">
                Reset the demo data
              </SubmitButton>
            </form>
          </section>
        )}
      </div>
    </>
  );
}

function QueueItem({ tone, tag, title, body, note, children }: { tone: Tone; tag: string; title: string; body: string; note?: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{tag}</Badge>
          <span className="text-sm font-semibold">{title}</span>
          {note && <Badge>{note}</Badge>}
        </div>
        <p className="text-sm text-muted">{body}</p>
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </li>
  );
}

function TripRow({ t, canAct }: { t: TripView; canAct: boolean }) {
  return (
    <li className="grid gap-4 py-4 first:pt-0 last:pb-0 md:grid-cols-[1.5fr_1fr_auto] md:items-center">
      <div className="min-w-0">
        <p className="font-medium">
          {t.restaurant.name} → {t.shelter.name}
        </p>
        <p className="text-sm text-muted">
          {t.listing.totalPortions} portions · {t.driver?.name ?? "no driver yet"} · by {timeLabel(t.trip.plannedDropoffAt)} · <Money cents={t.trip.stipendCents} /> from{" "}
          {t.funding.map((f) => f.label).join(" + ") || "nobody yet"}
        </p>
        <p className="mt-1 text-xs text-muted">&ldquo;{t.match.reason}&rdquo;</p>
      </div>
      <div className="space-y-2">
        <TripStatusBadge status={t.trip.status} />
        <RescueSteps status={t.trip.status} />
      </div>
      {canAct && (
        <div className="flex flex-wrap gap-2 md:flex-col md:items-end">
          {t.trip.status === "assigned" && (
            <form action={coordinatorReassign.bind(null, t.trip.id)}>
              <SubmitButton variant="secondary" pendingText="Re-planning…" className={smallButton}>
                Driver dropped out
              </SubmitButton>
            </form>
          )}
          {["unfunded", "funded", "assigned"].includes(t.trip.status) && (
            <form action={coordinatorCancel.bind(null, t.trip.id)}>
              <SubmitButton variant="danger" pendingText="Cancelling…" className={smallButton} confirm="Cancel this rescue? Its reserved money goes back to the fund.">
                Cancel
              </SubmitButton>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
