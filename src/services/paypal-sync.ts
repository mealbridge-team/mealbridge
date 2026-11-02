import type { Db } from "@/db";
import { paypalMode } from "@/paypal/client";
import { refreshInvoices } from "./invoices";
import { syncAllPlanPayments } from "./subscriptions";
import { refreshPendingPayouts } from "./treasury";

// Webhooks are the fast path, but PayPal's sandbox can deliver them hours late (we saw an invoice
// payment arrive 8 hours after the sponsor paid). This catch-up asks PayPal directly every few
// minutes, so payouts settle, paid invoices fund trips and plan payments land with nobody pressing
// a button. Every step is idempotent: the ledger is keyed on PayPal references.
export async function syncWithPayPal(db: Db) {
  const steps = [
    ["payouts", () => refreshPendingPayouts(db)],
    ["invoices", () => refreshInvoices(db)],
    ["plans", () => syncAllPlanPayments(db)],
  ] as const;
  for (const [name, run] of steps) {
    try {
      await run();
    } catch (err) {
      console.error(`PayPal sync (${name}) failed`, err);
    }
  }
}

const SYNC_EVERY_MS = 2 * 60_000;

export function startPayPalSync(db: Db) {
  const scope = globalThis as { mealbridgePayPalSync?: NodeJS.Timeout };
  if (paypalMode() === "mock" || scope.mealbridgePayPalSync) return;
  let running = false;
  scope.mealbridgePayPalSync = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await syncWithPayPal(db);
    } finally {
      running = false;
    }
  }, SYNC_EVERY_MS);
  scope.mealbridgePayPalSync.unref();
}
