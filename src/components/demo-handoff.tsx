import { ArrowRight, Repeat } from "lucide-react";
import { signInAs } from "@/app/actions";
import type { Role } from "@/lib/demo-session";
import { SubmitButton } from "./submit-button";

// Demo only: the next person in a rescue lives behind their own sign-in, so this offers the switch
// in one click ("Continue as Maya R., the driver") to keep one rescue flowing end to end.
export function DemoHandoff({ role, id, name, what }: { role: Role; id: string; name: string; what: string }) {
  return (
    <form
      action={signInAs.bind(null, role, id)}
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-brand/50 bg-brand-soft px-4 py-3"
    >
      <p className="flex items-center gap-2.5 text-sm">
        <Repeat className="h-4 w-4 shrink-0 text-brand" aria-hidden />
        <span>
          <span className="font-semibold">Demo:</span> {what}
        </span>
      </p>
      <SubmitButton pendingText="Switching…" className="min-h-10 px-4">
        Continue as {name} <ArrowRight className="h-4 w-4" aria-hidden />
      </SubmitButton>
    </form>
  );
}
