"use client";

import { useActionState } from "react";
import { coordinatorInvoice } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/ui";

export function InvoiceForm({ sponsors }: { sponsors: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(coordinatorInvoice, null);
  return (
    <form action={action} className="grid gap-2 sm:grid-cols-[1.4fr_0.8fr]">
      <select name="sponsorId" className={inputClass} aria-label="Sponsor">
        {sponsors.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
        <input name="amount" type="number" min={10} max={5000} step={1} defaultValue={150} className={`${inputClass} pl-6`} aria-label="Amount in dollars" />
      </div>
      <input name="memo" placeholder="What it funds, e.g. December rescues in Oakland" className={`${inputClass} sm:col-span-2`} />
      <button type="submit" disabled={pending} className={`${buttonClass.primary} sm:col-span-2`}>
        {pending ? "Sending through PayPal…" : "Send PayPal invoice"}
      </button>
      {state && <p className={`text-sm sm:col-span-2 ${state.ok ? "text-leaf" : "text-berry"}`}>{state.message}</p>}
    </form>
  );
}
