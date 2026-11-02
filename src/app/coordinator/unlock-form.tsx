"use client";

import { useActionState } from "react";
import { unlockCoordinatorAction } from "@/app/actions";
import { buttonClass, inputClass } from "@/components/ui";

export function UnlockForm() {
  const [error, action, pending] = useActionState(unlockCoordinatorAction, null);
  return (
    <form action={action} className="w-full space-y-1.5 md:w-80">
      <label htmlFor="passcode" className="block text-sm font-medium">
        Coordinator passcode
      </label>
      <div className="flex gap-2">
        <input id="passcode" name="passcode" type="password" autoComplete="current-password" required className={inputClass} aria-describedby={error ? "passcode-error" : undefined} />
        <button type="submit" disabled={pending} className={buttonClass.primary}>
          {pending ? "Checking…" : "Unlock"}
        </button>
      </div>
      {error && (
        <p id="passcode-error" role="alert" className="text-sm text-bad">
          {error}
        </p>
      )}
    </form>
  );
}
