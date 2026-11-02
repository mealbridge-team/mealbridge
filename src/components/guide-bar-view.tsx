"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Check, X } from "lucide-react";
import { guideExit, guideStart, signInAs } from "@/app/actions";
import type { GuideState } from "@/lib/demo-guide";
import type { Persona } from "@/lib/demo-session";
import { PORTAL, ROLE_LABEL } from "@/lib/roles";
import { SubmitButton } from "./submit-button";
import { buttonClass } from "./ui";

const STEPS = ["Restaurant posts", "Driver delivers", "Shelter confirms", "Driver paid"];

export function GuideBarView({ state, persona }: { state: GuideState; persona: Persona | null }) {
  const pathname = usePathname();
  const { step, who } = state;
  const finished = step === 4;
  const isWho = persona?.role === who.role && persona.id === who.id;
  const onPage = isWho && pathname === PORTAL[who.role];
  // The previous step's person is still signed in: that step is done, hand over to the next one.
  const handover = !finished && !state.problem && !isWho && step > 1;
  const kicker = finished ? "Guided rescue · finished" : handover ? `Step ${step - 1} done` : `Guided rescue · step ${step} of 4`;
  const shortKicker = finished ? "Finished" : handover ? `Step ${step - 1} done` : `Step ${step} of 4`;
  const exit = (
    <form action={guideExit}>
      <button type="submit" className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2.5 text-sm text-muted hover:bg-surface hover:text-ink">
        <X className="h-4 w-4" aria-hidden /> {finished ? "Close" : "Exit guide"}
      </button>
    </form>
  );

  return (
    <aside aria-label="Guided rescue" className="sticky bottom-0 z-[1050] border-t border-line bg-bg/95 shadow-[0_-8px_24px_rgb(0_0_0/0.06)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 sm:px-6 md:flex-row md:items-center md:gap-6 md:py-3">
        {/* Phones: steps, label and exit share one row to keep the bar short. */}
        <div className="flex items-center justify-between gap-3 md:contents">
          <ol className="flex shrink-0 items-center gap-1" aria-label={`Step ${step} of 4`}>
            {STEPS.map((label, i) => {
              const n = i + 1;
              const done = n < step || finished;
              const current = n === step && !finished;
              return (
                <li key={label} className="flex items-center gap-1.5">
                  <span
                    title={label}
                    className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold md:h-7 md:w-7 md:text-xs ${
                      done ? "bg-brand text-on-brand" : current ? "border-2 border-brand text-brand" : "border border-line text-muted"
                    }`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : n}
                    <span className="sr-only">
                      {label}
                      {done ? " (done)" : current ? " (now)" : ""}
                    </span>
                  </span>
                  {n < 4 && <span className={`h-0.5 w-3 rounded-full md:w-6 ${n < step || finished ? "bg-brand" : "bg-line"}`} aria-hidden />}
                </li>
              );
            })}
          </ol>
          <p className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.1em] text-brand md:hidden">{shortKicker}</p>
          <div className="md:hidden">{exit}</div>
        </div>

        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="hidden text-xs font-semibold uppercase tracking-[0.1em] text-brand md:block">{kicker}</p>
          <p className="text-[15px] font-semibold leading-snug md:text-base">
            {handover ? `Next up: the ${ROLE_LABEL[who.role].toLowerCase()}, ${who.name}.` : state.title}
          </p>
          {state.problem ? (
            <p className="line-clamp-3 text-sm text-warn md:line-clamp-none">{state.problem}</p>
          ) : (
            !handover && state.todo && <p className="line-clamp-2 text-sm text-muted md:line-clamp-none">{state.todo}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 empty:hidden">
          {finished ? (
            <Link href="/impact" className={`${buttonClass.primary} min-h-10`}>
              See it on Impact <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : state.restart ? (
            <form action={guideStart}>
              <SubmitButton pendingText="Starting…" className="min-h-10">
                Start a new rescue <ArrowRight className="h-4 w-4" aria-hidden />
              </SubmitButton>
            </form>
          ) : (
            !onPage && (
              <form action={signInAs.bind(null, who.role, who.id)}>
                <SubmitButton pendingText="Switching…" className="min-h-10">
                  {isWho ? `Back to ${who.name}` : `Continue as ${who.name}`} <ArrowRight className="h-4 w-4" aria-hidden />
                </SubmitButton>
              </form>
            )
          )}
          <div className="hidden md:block">{exit}</div>
        </div>
      </div>
    </aside>
  );
}
