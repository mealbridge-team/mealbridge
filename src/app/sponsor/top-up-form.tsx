"use client";

import { useActionState, useState } from "react";
import { ExternalLink } from "lucide-react";
import { sponsorTopUp } from "@/app/actions";
import { buttonClass, Field, inputClass, Notice } from "@/components/ui";

const PRESETS = [50, 100, 250];

export function TopUpForm({ sponsorId }: { sponsorId: string }) {
  const [state, action, pending] = useActionState(sponsorTopUp.bind(null, sponsorId), null);
  const [amount, setAmount] = useState(100);

  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Amount</legend>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              aria-pressed={amount === p}
              className={`min-h-11 rounded-lg border text-sm font-semibold tabular-nums transition-colors ${amount === p ? "border-ink bg-ink text-bg" : "border-line hover:bg-surface"}`}
            >
              ${p}
            </button>
          ))}
        </div>
        <input type="hidden" name="amount" value={amount} />
        <p className="mt-2 text-xs text-muted">${amount} covers about {Math.round(amount / 4)} rescue trips.</p>
      </fieldset>
      <Field label="Note on the invoice" hint="Optional, e.g. a grant or purchase-order number." htmlFor="memo">
        <input id="memo" name="memo" maxLength={200} className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full`}>
        {pending ? "Creating the PayPal invoice…" : "Get a PayPal invoice"}
      </button>

      <div aria-live="polite">
        {state && !state.ok && <Notice tone="bad">{state.message}</Notice>}
        {state?.ok && (
          <Notice tone="ok" title={state.message}>
            {state.payUrl ? (
              <a href={state.payUrl} target="_blank" rel="noreferrer" className={`${buttonClass.paypal} mt-3 w-full`}>
                Pay it with PayPal <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
            ) : (
              "It's in your invoice list below."
            )}
          </Notice>
        )}
      </div>
    </form>
  );
}
