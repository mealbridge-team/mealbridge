"use client";

import { useActionState } from "react";
import { coordinatorInvoice } from "@/app/actions";
import { buttonClass, Field, inputClass, Notice } from "@/components/ui";

export function InvoiceForm({ sponsors }: { sponsors: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(coordinatorInvoice, null);
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1.5fr_1fr]">
        <Field label="Sponsor" htmlFor="sponsorId">
          <select id="sponsorId" name="sponsorId" className={inputClass}>
            {sponsors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount" htmlFor="amount">
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
            <input id="amount" name="amount" type="number" min={10} max={5000} step={1} defaultValue={150} className={`${inputClass} pl-7`} />
          </div>
        </Field>
      </div>
      <Field label="What it funds" htmlFor="memo" hint="Shown to the sponsor on the PayPal invoice.">
        <input id="memo" name="memo" placeholder="e.g. December rescues in Oakland" className={inputClass} />
      </Field>
      <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full`}>
        {pending ? "Sending through PayPal…" : "Send PayPal invoice"}
      </button>
      {state && <Notice tone={state.ok ? "ok" : "bad"}>{state.message}</Notice>}
    </form>
  );
}
