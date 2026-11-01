"use client";

import { useActionState } from "react";
import { unlockCoordinatorAction } from "@/app/actions";
import { buttonClass } from "@/components/ui";

export function UnlockForm() {
  const [error, action, pending] = useActionState(unlockCoordinatorAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <label htmlFor="passcode" className="text-sm">
        Coordinator passcode
      </label>
      <input id="passcode" name="passcode" type="password" required className="rounded-xl border border-line bg-paper px-3 py-2 text-sm" />
      <button type="submit" disabled={pending} className={buttonClass.primary}>
        {pending ? "Checking…" : "Unlock"}
      </button>
      {error && <p className="w-full text-sm text-berry">{error}</p>}
    </form>
  );
}
