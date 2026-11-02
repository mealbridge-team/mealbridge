"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { buttonClass, Field, inputClass, Notice } from "@/components/ui";

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

export function DonateForm({
  funds,
  initialFundId,
  tripId,
  tripAmountCents,
  mode,
}: {
  funds: Fund[];
  initialFundId: string;
  tripId?: string;
  tripAmountCents?: number;
  mode: "sandbox" | "mock";
}) {
  const router = useRouter();
  const [fundId, setFundId] = useState(initialFundId);
  const [amountCents, setAmountCents] = useState(tripAmountCents ?? 500);
  const [custom, setCustom] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
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
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Enter an email address so we can send your receipt.");
      document.getElementById("donor-email")?.focus();
      return;
    }
    setEmailError(null);
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
      <div className="space-y-4 py-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-brand" aria-hidden />
        <p className="mx-auto max-w-sm text-lg font-medium">{status.message}</p>
        <button className={buttonClass.secondary} onClick={() => setStatus({ kind: "idle" })}>
          Give again
        </button>
      </div>
    );
  }

  const presets = tripAmountCents && !PRESETS.includes(tripAmountCents) ? [tripAmountCents, ...PRESETS] : PRESETS;

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="mb-3 text-sm font-semibold">1. Where should it go?</legend>
        <div className="space-y-2">
          {funds.map((f) => (
            <label key={f.id} className={`flex min-h-12 items-center gap-3 rounded-lg border px-4 text-sm transition-colors ${fundId === f.id ? "border-ink" : "border-line hover:bg-surface"}`}>
              <input type="radio" name="fund" checked={fundId === f.id} onChange={() => setFundId(f.id)} className="accent-[var(--brand)]" />
              {f.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold">2. Amount</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {presets.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={!custom && amountCents === c}
              onClick={() => {
                setCustom("");
                setAmountCents(c);
              }}
              className={`min-h-11 rounded-lg border text-sm font-semibold tabular-nums transition-colors ${!custom && amountCents === c ? "border-ink bg-ink text-bg" : "border-line hover:bg-surface"}`}
            >
              ${(c / 100).toFixed(c % 100 ? 2 : 0)}
            </button>
          ))}
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
            <input
              inputMode="decimal"
              aria-label="Other amount in dollars"
              placeholder="Other"
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                const cents = Math.round(Number(e.target.value) * 100);
                if (Number.isFinite(cents) && cents > 0) setAmountCents(cents);
              }}
              className={`${inputClass} pl-7 text-center`}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-muted">$5 covers a typical rescue trip&apos;s fuel. Between $1 and $500.</p>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-3 text-sm font-semibold">3. Your details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="donor-name" hint="Optional">
            <input id="donor-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={inputClass} />
          </Field>
          <Field label="Email for your receipt" htmlFor="donor-email">
            <input
              id="donor-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              required
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? "donor-email-error" : undefined}
              className={inputClass}
            />
            {emailError && (
              <p id="donor-email-error" className="text-xs text-bad">
                {emailError}
              </p>
            )}
          </Field>
        </div>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
          Show me as anonymous on the public dashboard
        </label>
      </fieldset>

      <div className="space-y-2">
        <button type="button" onClick={pay} disabled={!sdkReady || status.kind === "working"} className={`${buttonClass.paypal} w-full text-base`}>
          {status.kind === "working"
            ? "Waiting for PayPal…"
            : !sdkReady
              ? "Loading PayPal…"
              : `Give $${(amountCents / 100).toFixed(amountCents % 100 ? 2 : 0)} with PayPal${mode === "mock" ? " (simulated)" : ""}`}
        </button>
        {mode === "mock" && <p className="text-xs text-muted">Demo mode: no PayPal keys are set, so this simulates a sandbox payment.</p>}
        {status.kind === "error" && <Notice tone="bad">{status.message}</Notice>}
      </div>
    </div>
  );
}
