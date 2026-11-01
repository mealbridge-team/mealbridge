"use client";

import { useActionState } from "react";
import { coordinatorReminder } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/ui";

// Nudge agent: first click drafts a friendly reminder from the ledger, second click sends it.
export function ReminderForm({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState(coordinatorReminder.bind(null, invoiceId), null);

  if (state?.stage === "sent") return <p className="text-xs text-leaf">Reminder sent through PayPal.</p>;
  return (
    <form action={action} className="space-y-2">
      {state?.stage === "draft" && (
        <>
          <textarea name="note" defaultValue={state.text} rows={4} className={`${inputClass} text-xs`} aria-label="Reminder note" />
          <p className="text-[11px] text-muted">{state.mode === "gemini" ? "Drafted by the Nudge agent (Gemini). Edit before sending." : "Template draft (AI unavailable)."}</p>
        </>
      )}
      {state?.stage === "error" && <p className="text-xs text-berry">{state.message}</p>}
      <button type="submit" disabled={pending} className={`${buttonClass.secondary} px-3 py-1.5 text-xs`}>
        {pending ? "Working…" : state?.stage === "draft" ? "Send reminder" : "Draft a friendly reminder"}
      </button>
    </form>
  );
}
