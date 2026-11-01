import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getDb } from "@/db";
import { sponsors as sponsorsTable } from "@/db/schema";
import {
  checkInvoices,
  checkPayouts,
  coordinatorApprove,
  coordinatorCancel,
  coordinatorDismissAlert,
  coordinatorReassign,
  coordinatorRetryPayout,
  coordinatorSimulateInvoice,
  resetDemo,
} from "@/app/actions";
import { openAlerts, tripViews, type TripView } from "@/lib/queries";
import { poolBalances } from "@/services/treasury";
import { invoiceViews } from "@/services/invoices";
import { paypalMode } from "@/paypal/client";
import { formatUsd } from "@/domain/stipend";
import { isCoordinator } from "@/lib/access";
import { isTonight } from "@/lib/clock";
import { AutoRefresh } from "@/components/auto-refresh";
import { LiveMap } from "@/components/live-map";
import { SubmitButton } from "@/components/submit-button";
import { AREA_LABEL, Badge, Card, Empty, Money, PageTitle, RescueSteps, Skeleton, TripStatusBadge, timeLabel, type Tone } from "@/components/ui";
import { InvoiceForm } from "./invoice-form";
import { ReminderForm } from "./reminder-form";
import { UnlockForm } from "./unlock-form";

export default function CoordinatorPage() {
  return (
    <>
      <PageTitle eyebrow="For coordinators" title="The agents handle the routine." subtitle="You only see what needs a person: deliveries to check, trips nobody can fund yet, and sponsors to bill." />
      <Suspense fallback={<Card><Skeleton lines={8} /></Card>}>
        <CoordinatorView />
      </Suspense>
      <AutoRefresh everyMs={15_000} />
    </>
  );
}

const ALERT_LABEL: Record<string, { label: string; tone: Tone }> = {
  unfunded_trip: { label: "Needs funding", tone: "tomato" },
  low_fund: { label: "Fund running low", tone: "saffron" },
  late_driver: { label: "Driver late", tone: "saffron" },
  verification_failed: { label: "Check delivery", tone: "berry" },
  unsafe_listing: { label: "Food safety", tone: "saffron" },
  payout_failed: { label: "Payout failed", tone: "berry" },
  payout_unclaimed: { label: "Payout unclaimed", tone: "saffron" },
};

async function CoordinatorView() {
  await connection();
  const db = getDb();
  const [alerts, trips, pools, invoices, sponsors] = await Promise.all([
    openAlerts(db),
    tripViews(db, { limit: 60 }),
    poolBalances(db),
    invoiceViews(db),
    db.select().from(sponsorsTable),
  ]);
  const canAct = await isCoordinator();
  const tonight = trips.filter((t) => isTonight(t.trip.createdAt));
  const review = tonight.filter((t) => t.trip.status === "needs_review");
  const stuckPayouts = tonight.filter((t) => t.trip.status === "verified");
  const unfunded = tonight.filter((t) => t.trip.status === "unfunded");
  const pendingPayouts = tonight.filter((t) => t.trip.status === "payout_pending").length;
  const openInvoices = invoices.filter((i) => i.invoice.status === "sent");
  const queueSize = review.length + stuckPayouts.length + unfunded.length + alerts.length;

  return (
    <div className="space-y-6">
      {!canAct && (
        <Card className="border-saffron/40 bg-saffron-soft/40">
          <p className="mb-3 text-sm text-muted">
            You can watch everything here. Approving payouts, re-planning trips, invoicing sponsors and resetting the demo need the coordinator passcode (judges: it&apos;s in the README).
          </p>
          <UnlockForm />
        </Card>
      )}

      <Card title="Needs you now" action={<Badge tone={queueSize ? "tomato" : "leaf"}>{queueSize ? `${queueSize} open` : "All clear"}</Badge>}>
        {queueSize === 0 ? (
          <Empty>Nothing needs a person right now. The agents are matching, funding, dispatching and paying on their own.</Empty>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {review.map((t) => (
              <QueueItem key={t.trip.id} tone="berry" tag="Check delivery" title={`${t.restaurant.name} → ${t.shelter.name}`} body={t.trip.verification?.notes.join(" ") ?? "Signals don't agree."}>
                {canAct && (
                  <form action={coordinatorApprove.bind(null, t.trip.id)}>
                    <SubmitButton pendingText="Paying…">Approve and pay <Money cents={t.trip.stipendCents} /></SubmitButton>
                  </form>
                )}
              </QueueItem>
            ))}
            {stuckPayouts.map((t) => (
              <QueueItem key={t.trip.id} tone="berry" tag="Payout didn't go through" title={`${t.driver?.name ?? "Driver"} · ${t.restaurant.name} → ${t.shelter.publicLabel}`} body="Verified, but PayPal hasn't accepted the payout yet.">
                {canAct && (
                  <form action={coordinatorRetryPayout.bind(null, t.trip.id)}>
                    <SubmitButton pendingText="Paying…">Retry payout</SubmitButton>
                  </form>
                )}
              </QueueItem>
            ))}
            {unfunded.map((t) => (
              <QueueItem key={t.trip.id} tone="tomato" tag="Waiting for funding" title={`${t.listing.totalPortions} portions in ${AREA_LABEL[t.restaurant.area]}`} body={`Needs ${formatUsd(t.trip.stipendCents)} before a driver can go. Donors see it on the Donate page.`}>
                <Link href={`/donate?trip=${t.trip.id}`} className="text-sm font-semibold text-tomato underline">
                  Open its donation page
                </Link>
              </QueueItem>
            ))}
            {alerts.map((a) => {
              const meta = ALERT_LABEL[a.kind] ?? { label: a.kind, tone: "muted" as Tone };
              return (
                <QueueItem key={a.id} tone={meta.tone} tag={meta.label} title={timeLabel(a.createdAt)} body={a.message}>
                  {canAct && (
                    <form action={coordinatorDismissAlert.bind(null, a.id)}>
                      <SubmitButton variant="secondary" pendingText="…" className="px-3 py-1.5 text-xs">
                        Dismiss
                      </SubmitButton>
                    </form>
                  )}
                </QueueItem>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card title="On the road">
          <LiveMap height={340} />
        </Card>
        <Card title="Rescue funds">
          <ul className="divide-y divide-line text-sm">
            {pools.map((p) => (
              <li key={p.id} className="flex justify-between gap-2 py-2">
                <span>
                  {p.label}
                  {p.area && <span className="text-muted"> · {AREA_LABEL[p.area]}</span>}
                </span>
                <span className={`font-semibold ${p.availableCents < 500 ? "text-tomato" : ""}`}>
                  <Money cents={p.availableCents} />
                </span>
              </li>
            ))}
          </ul>
          <form action={checkPayouts} className="mt-4">
            <SubmitButton variant="secondary" pendingText="Asking PayPal…" className="w-full">
              Check payouts with PayPal{pendingPayouts ? ` (${pendingPayouts} pending)` : ""}
            </SubmitButton>
          </form>
        </Card>
      </div>

      <Card title="Sponsors and city grants" action={<Badge tone={openInvoices.length ? "saffron" : "leaf"}>{openInvoices.length} unpaid</Badge>}>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="mb-3 text-sm text-muted">Bill a sponsor with a PayPal invoice. When they pay, the money lands in their fund and waiting trips are funded automatically.</p>
            {canAct ? <InvoiceForm sponsors={sponsors.map((s) => ({ id: s.id, name: s.name }))} /> : <p className="text-sm text-muted">Unlock to send invoices.</p>}
          </div>
          <div>
            {invoices.length === 0 ? (
              <Empty>No invoices yet.</Empty>
            ) : (
              <ul className="space-y-2 text-sm">
                {invoices.slice(0, 6).map(({ invoice, sponsor }) => (
                  <li key={invoice.id} className="rounded-2xl border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{sponsor.name}</span>
                      <span className="flex items-center gap-2">
                        <Money cents={invoice.amountCents} />
                        <Badge tone={invoice.status === "paid" ? "leaf" : invoice.status === "sent" ? "saffron" : "muted"}>{invoice.status === "sent" ? "Unpaid" : invoice.status}</Badge>
                      </span>
                    </div>
                    <p className="text-xs text-muted">
                      {invoice.invoiceNumber} · {invoice.memo}
                      {invoice.payerViewUrl && (
                        <>
                          {" · "}
                          <a href={invoice.payerViewUrl} target="_blank" rel="noreferrer" className="text-sky underline">
                            Open in PayPal
                          </a>
                        </>
                      )}
                    </p>
                    {invoice.status === "sent" && canAct && (
                      <div className="mt-2 flex flex-wrap items-start gap-2">
                        <ReminderForm invoiceId={invoice.id} />
                        {invoice.paypalInvoiceId.startsWith("MOCK-") && (
                          <form action={coordinatorSimulateInvoice.bind(null, invoice.id)}>
                            <SubmitButton variant="secondary" pendingText="…" className="px-3 py-1.5 text-xs">
                              Simulate sponsor paying
                            </SubmitButton>
                          </form>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {openInvoices.length > 0 && paypalMode() === "sandbox" && (
              <form action={checkInvoices} className="mt-3">
                <SubmitButton variant="secondary" pendingText="Asking PayPal…" className="w-full">
                  Check invoices with PayPal
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      </Card>

      <Card title="Tonight's rescues" action={<span className="text-xs text-muted">{tonight.length} in the last 14 hours</span>}>
        {tonight.length === 0 ? (
          <Empty>No rescues yet tonight. Post food from the Restaurant screen to start one.</Empty>
        ) : (
          <ul className="space-y-3">
            {tonight.map((t) => (
              <TripRow key={t.trip.id} t={t} canAct={canAct} />
            ))}
          </ul>
        )}
      </Card>

      {canAct && (
        <form action={resetDemo} className="flex justify-end">
          <SubmitButton variant="danger" pendingText="Resetting…">
            Reset the demo data
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

function QueueItem({ tone, tag, title, body, children }: { tone: Tone; tag: string; title: string; body: string; children?: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-line p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{tag}</Badge>
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <p className="text-sm text-muted">{body}</p>
      {children && <div>{children}</div>}
    </li>
  );
}

function TripRow({ t, canAct }: { t: TripView; canAct: boolean }) {
  return (
    <li className="grid gap-3 rounded-2xl bg-cream p-4 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
      <div>
        <p className="font-semibold">
          {t.restaurant.name} → {t.shelter.name}
        </p>
        <p className="text-xs text-muted">
          {t.listing.totalPortions} portions · {t.driver?.name ?? "no driver yet"} · drop-off {timeLabel(t.trip.plannedDropoffAt)} · <Money cents={t.trip.stipendCents} /> from{" "}
          {t.funding.map((f) => f.label).join(" + ") || "nobody yet"}
        </p>
        <p className="mt-1 text-xs italic text-muted">&ldquo;{t.match.reason}&rdquo;</p>
      </div>
      <div className="space-y-2">
        <TripStatusBadge status={t.trip.status} />
        <RescueSteps status={t.trip.status} />
      </div>
      {canAct && (
        <div className="flex flex-wrap gap-2 md:flex-col">
          {t.trip.status === "assigned" && (
            <form action={coordinatorReassign.bind(null, t.trip.id)}>
              <SubmitButton variant="secondary" pendingText="Re-planning…" className="px-3 py-1.5 text-xs">
                Driver dropped out
              </SubmitButton>
            </form>
          )}
          {["unfunded", "funded", "assigned"].includes(t.trip.status) && (
            <form action={coordinatorCancel.bind(null, t.trip.id)}>
              <SubmitButton variant="danger" pendingText="Cancelling…" className="px-3 py-1.5 text-xs">
                Cancel
              </SubmitButton>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
