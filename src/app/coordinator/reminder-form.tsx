"use client";

import { useActionState } from "react";
import { coordinatorReminder } from "@/app/actions";
import { buttonClass, inputClass, smallButton } from "@/components/ui";

// Nudge agent: the first click drafts a friendly reminder from the ledger, the second sends it.
export function ReminderForm({ invoiceId }: { invoiceId: string }) {
  const [state, action, pending] = useActionState(coordinatorReminder.bind(null, invoiceId), null);

  if (state?.stage === "sent") return <p className="text-xs text-ok">Reminder sent through PayPal.</p>;
  return (
    <form action={action} className="w-full space-y-2">
      {state?.stage === "draft" && (
        <>
          <textarea name="note" defaultValue={state.text} rows={4} className={`${inputClass} text-sm`} aria-label="Reminder note" />
          <p className="text-xs text-muted">{state.mode === "gemini" ? "Drafted by the Nudge agent from this sponsor's impact. Edit before sending." : "Template draft (AI unavailable)."}</p>
        </>
      )}
      {state?.stage === "error" && <p className="text-xs text-bad">{state.message}</p>}
      <button type="submit" disabled={pending} className={`${buttonClass.secondary} ${smallButton}`}>
        {pending ? "Working…" : state?.stage === "draft" ? "Send reminder" : "Draft a friendly reminder"}
      </button>
    </form>
  );
}
