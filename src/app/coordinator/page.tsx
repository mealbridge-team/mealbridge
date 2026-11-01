import { Suspense } from "react";
import { connection } from "next/server";
import { getDb } from "@/db";
import {
  checkPayouts,
  coordinatorApprove,
  coordinatorCancel,
  coordinatorReassign,
  coordinatorRetryPayout,
  resetDemo,
} from "@/app/actions";
import { openAlerts, tripViews } from "@/lib/queries";
import { poolBalances } from "@/services/treasury";
import { SubmitButton } from "@/components/submit-button";
import { isCoordinator } from "@/lib/access";
import { UnlockForm } from "./unlock-form";
import { AREA_LABEL, Badge, Card, Empty, Money, PageTitle, Skeleton, TripStatusBadge, timeLabel } from "@/components/ui";

export default function CoordinatorPage() {
  return (
    <>
      <PageTitle title="Coordinator console" subtitle="The agents handle the routine. You handle the exceptions." />
      <Suspense fallback={<Card><Skeleton lines={8} /></Card>}>
        <CoordinatorView />
      </Suspense>
    </>
  );
}

const ALERT_TONE = {
  unfunded_trip: "berry",
  low_fund: "saffron",
  late_driver: "saffron",
  verification_failed: "berry",
  unsafe_listing: "saffron",
  payout_failed: "berry",
  payout_unclaimed: "saffron",
} as const;

async function CoordinatorView() {
  await connection();
  const db = getDb();
  const [alerts, trips, pools] = await Promise.all([openAlerts(db), tripViews(db, { limit: 40 }), poolBalances(db)]);
  const pendingPayouts = trips.filter((t) => t.trip.status === "payout_pending").length;
  const canAct = await isCoordinator();

  return (
    <div className="space-y-5">
      {!canAct && (
        <Card>
          <p className="mb-3 text-sm text-muted">
            You can watch everything here. Approving payouts, re-planning trips and resetting the demo need the
            coordinator passcode (judges: it&apos;s in the README).
          </p>
          <UnlockForm />
        </Card>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Alerts" action={<Badge tone={alerts.length ? "berry" : "leaf"}>{alerts.length} open</Badge>}>
          {alerts.length === 0 ? (
            <Empty>All clear.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {alerts.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <Badge tone={ALERT_TONE[a.kind]}>{a.kind.replaceAll("_", " ")}</Badge>
                  <span>{a.message}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Rescue funds">
          <ul className="divide-y divide-line text-sm">
            {pools.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>
                  {p.label}
                  {p.area && <span className="text-muted"> · {AREA_LABEL[p.area]}</span>}
                </span>
                <span className={p.availableCents < 500 ? "text-berry" : ""}>
                  <Money cents={p.availableCents} />
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={checkPayouts}>
              <SubmitButton variant="secondary" pendingText="Asking PayPal…">
                Check payouts with PayPal{pendingPayouts ? ` (${pendingPayouts})` : ""}
              </SubmitButton>
            </form>
            {canAct && (
              <form action={resetDemo}>
                <SubmitButton variant="danger" pendingText="Resetting…">Reset demo data</SubmitButton>
              </form>
            )}
          </div>
        </Card>
      </div>

      <Card title="Tonight's trips">
        {trips.length === 0 ? (
          <Empty>No trips yet. Post surplus from the Restaurant screen to start one.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="py-2 pr-3">Route</th>
                  <th className="py-2 pr-3">Driver</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Funded by</th>
                  <th className="py-2 pr-3 text-right">Stipend</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {trips.map((t) => (
                  <tr key={t.trip.id} className="align-top">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{t.restaurant.name} → {t.shelter.name}</p>
                      <p className="text-xs text-muted">
                        {t.listing.totalPortions} portions · drop-off {timeLabel(t.trip.plannedDropoffAt)}
                      </p>
                      <p className="text-xs text-muted">{t.match.reason}</p>
                    </td>
                    <td className="py-2 pr-3">{t.driver?.name ?? "-"}</td>
                    <td className="py-2 pr-3">
                      <TripStatusBadge status={t.trip.status} />
                      {t.trip.verification?.notes.map((n) => (
                        <p key={n} className="mt-1 text-xs text-muted">{n}</p>
                      ))}
                    </td>
                    <td className="py-2 pr-3 text-xs">{t.funding.map((f) => f.label).join(", ") || "-"}</td>
                    <td className="py-2 pr-3 text-right"><Money cents={t.trip.stipendCents} /></td>
                    <td className="py-2">
                      {canAct && (
                      <div className="flex flex-col gap-1">
                        {t.trip.status === "needs_review" && (
                          <form action={coordinatorApprove.bind(null, t.trip.id)}>
                            <SubmitButton pendingText="Paying…">Approve &amp; pay</SubmitButton>
                          </form>
                        )}
                        {t.trip.status === "verified" && (
                          <form action={coordinatorRetryPayout.bind(null, t.trip.id)}>
                            <SubmitButton pendingText="Paying…">Retry payout</SubmitButton>
                          </form>
                        )}
                        {t.trip.status === "assigned" && (
                          <form action={coordinatorReassign.bind(null, t.trip.id)}>
                            <SubmitButton variant="secondary" pendingText="Re-planning…">Driver dropped out</SubmitButton>
                          </form>
                        )}
                        {["unfunded", "funded", "assigned"].includes(t.trip.status) && (
                          <form action={coordinatorCancel.bind(null, t.trip.id)}>
                            <SubmitButton variant="danger" pendingText="Cancelling…">Cancel</SubmitButton>
                          </form>
                        )}
                      </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
