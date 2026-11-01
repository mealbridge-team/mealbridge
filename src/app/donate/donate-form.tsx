"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui";

type Fund = { id: string; label: string };
type Status = { kind: "idle" | "working" | "error" | "done"; message?: string };

// Minimal typing for the PayPal JS SDK v6 surface we use.
type PayPalSession = { start: (opts: { presentationMode: "auto" }, order: Promise<{ orderId: string }>) => Promise<void> };
type PayPalSdk = {
  createInstance: (opts: { clientToken: string; components: string[]; pageType: string }) => Promise<{
    findEligibleMethods: (opts: { currencyCode: string }) => Promise<{ isEligible: (m: string) => boolean }>;
    createPayPalOneTimePaymentSession: (opts: {
      onApprove: (data: { orderId: string }) => Promise<void>;
      onCancel: () => void;
      onError: (err: unknown) => void;
    }) => PayPalSession;
  }>;
};
declare global {
  interface Window {
    paypal?: PayPalSdk;
  }
}

const SDK_URL = "https://www.sandbox.paypal.com/web-sdk/v6/core";
const PRESETS = [500, 1000, 2500];

function loadSdk(): Promise<PayPalSdk> {
  if (window.paypal) return Promise.resolve(window.paypal);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => (window.paypal ? resolve(window.paypal) : reject(new Error("PayPal SDK missing")));
    script.onerror = () => reject(new Error("Couldn't load PayPal"));
    document.head.appendChild(script);
  });
}

export function DonateForm({ funds, initialFundId, tripId, mode }: { funds: Fund[]; initialFundId: string; tripId?: string; mode: "sandbox" | "mock" }) {
  const router = useRouter();
  const [fundId, setFundId] = useState(initialFundId);
  const [amountCents, setAmountCents] = useState(500);
  const [name, setName] = useState("Ana P.");
  const [email, setEmail] = useState("ana.donor@example.com");
  const [anonymous, setAnonymous] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [sdkReady, setSdkReady] = useState(mode === "mock");
  const session = useRef<PayPalSession | null>(null);

  // Only called from the click handler, so it always sees the current form values.
  async function createOrder(): Promise<{ orderId: string }> {
    const res = await fetch("/api/donations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolId: fundId, amountCents, donorName: name, donorEmail: email, anonymous, tripId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Couldn't start the payment.");
    return { orderId: json.orderId };
  }

  async function capture(orderId: string) {
    const res = await fetch("/api/donations/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Payment didn't complete.");
    const funded = json.fundedTrips.length;
    setStatus({
      kind: "done",
      message: funded > 0 ? `Thank you. Your gift just funded ${funded} waiting rescue${funded === 1 ? "" : "s"}; a driver is being booked.` : "Thank you. Your gift is in the fund and will pay for the next rescue in this area.",
    });
    router.refresh();
  }

  useEffect(() => {
    if (mode !== "sandbox") return;
    let cancelled = false;
    (async () => {
      try {
        const tokenRes = await fetch("/api/paypal/client-token");
        const { clientToken } = await tokenRes.json();
        if (!tokenRes.ok || !clientToken) throw new Error("PayPal checkout couldn't start. Try again in a moment.");
        const sdk = await loadSdk();
        const instance = await sdk.createInstance({ clientToken, components: ["paypal-payments"], pageType: "checkout" });
        const methods = await instance.findEligibleMethods({ currencyCode: "USD" });
        if (!methods.isEligible("paypal")) throw new Error("PayPal isn't available in this browser.");
        session.current = instance.createPayPalOneTimePaymentSession({
          onApprove: async ({ orderId }) => {
            try {
              await capture(orderId);
            } catch (err) {
              setStatus({ kind: "error", message: (err as Error).message });
            }
          },
          onCancel: () => setStatus({ kind: "idle" }),
          onError: () => setStatus({ kind: "error", message: "PayPal reported a problem. Nothing was charged." }),
        });
        if (!cancelled) setSdkReady(true);
      } catch (err) {
        if (!cancelled) setStatus({ kind: "error", message: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function pay() {
    setStatus({ kind: "working" });
    if (mode === "mock") {
      try {
        const { orderId } = await createOrder();
        await capture(orderId);
      } catch (err) {
        setStatus({ kind: "error", message: (err as Error).message });
      }
      return;
    }
    // start() must run inside the click so the PayPal window isn't blocked as a pop-up.
    session.current
      ?.start({ presentationMode: "auto" }, createOrder())
      .catch((err: Error) => setStatus({ kind: "error", message: err.message }));
  }

  if (status.kind === "done") {
    return (
      <div className="space-y-3 rounded-xl bg-leaf-soft p-4">
        <p className="font-medium">{status.message}</p>
        <button className={buttonClass.secondary} onClick={() => setStatus({ kind: "idle" })}>
          Give again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium">Where should it go?</legend>
        {funds.map((f) => (
          <label key={f.id} className="flex items-center gap-2 text-sm">
            <input type="radio" name="fund" checked={fundId === f.id} onChange={() => setFundId(f.id)} />
            {f.label}
          </label>
        ))}
      </fieldset>

      <div>
        <p className="mb-1 text-sm font-medium">Amount</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setAmountCents(c)}
              className={`rounded-xl border px-4 py-2 text-sm ${amountCents === c ? "border-leaf bg-leaf text-white" : "border-line bg-paper"}`}
            >
              ${c / 100}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">$5 covers a typical rescue trip&apos;s fuel.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="rounded-xl border border-line bg-paper p-2.5 text-sm" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email for your receipt" className="rounded-xl border border-line bg-paper p-2.5 text-sm" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        Show me as anonymous on the public dashboard
      </label>

      <button type="button" onClick={pay} disabled={!sdkReady || status.kind === "working"} className="w-full rounded-xl bg-[#ffc439] px-4 py-3 text-base font-semibold text-[#111] hover:brightness-95 disabled:opacity-50">
        {status.kind === "working" ? "Waiting for PayPal…" : !sdkReady ? "Loading PayPal…" : mode === "mock" ? "Pay with PayPal (simulated)" : "Pay with PayPal"}
      </button>
      {mode === "mock" && <p className="text-xs text-muted">Demo mode: no PayPal keys set, so this simulates a sandbox payment.</p>}
      {status.kind === "error" && <p className="text-sm text-berry">{status.message}</p>}
    </div>
  );
}
