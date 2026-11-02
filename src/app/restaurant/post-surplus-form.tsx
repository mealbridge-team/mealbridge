"use client";

import { useActionState, useRef } from "react";
import { postSurplus, type PostSurplusResult } from "@/app/actions";
import { PhotoInput } from "@/components/photo-input";
import { Badge, buttonClass, inputClass, Notice } from "@/components/ui";

const EXAMPLES = [
  "About 40 portions of veg biryani, kept hot, ready till 10pm",
  "Two trays of chicken teriyaki and rice, cooked an hour ago, in the warmer",
  "25 bean and cheese burritos, made at 6, kept hot",
];

export function PostSurplusForm({ restaurantId }: { restaurantId: string }) {
  const [result, action, pending] = useActionState<PostSurplusResult | null, FormData>(postSurplus, null);
  const notes = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-4" key={result?.ok ? "done" : "form"}>
        <input type="hidden" name="restaurantId" value={restaurantId} />
        <PhotoInput label="Photo of the food" />
        <div className="space-y-1.5">
          <label htmlFor="notes" className="block text-sm font-medium">
            Or describe it <span className="font-normal text-muted">(any language)</span>
          </label>
          <textarea ref={notes} id="notes" name="notes" rows={3} placeholder="What it is, roughly how many portions, and how it's been kept" className={inputClass} />
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-xs text-muted">Try:</span>
            {EXAMPLES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  if (notes.current) notes.current.value = e;
                }}
                className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-muted hover:text-ink"
              >
                {e.split(",")[0]}
              </button>
            ))}
          </div>
        </div>
        <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full`}>
          {pending ? "Reading the food and finding a shelter…" : "Post surplus"}
        </button>
        <p className="text-center text-xs text-muted">Always free. The trip is funded before a driver moves.</p>
      </form>

      <div aria-live="polite">
        {pending && <div className="h-28 animate-pulse rounded-xl bg-surface" />}
        {result && !pending && !result.ok && <Notice tone="bad">{result.error}</Notice>}
        {result && !pending && result.ok && <ResultCard result={result} />}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: Extract<PostSurplusResult, { ok: true }> }) {
  const { safety, match } = result;
  return (
    <div className="space-y-4 rounded-xl border border-line p-5">
      <div className="space-y-2">
        <p className="font-display text-lg font-semibold tracking-[-0.01em]">{result.summary}</p>
        <div className="flex flex-wrap gap-2">
          {safety.status === "approved" && <Badge tone="ok">Passed food-safety rules</Badge>}
          {safety.status === "review" && <Badge tone="warn">A coordinator checks this first</Badge>}
          {safety.status === "rejected" && <Badge tone="bad">Can&apos;t be rescued safely</Badge>}
          <Badge>{result.mode === "demo" ? "Read from your note (AI unavailable)" : "Read by Gemini"}</Badge>
        </div>
      </div>
      {safety.reasons.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          {safety.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {match?.kind === "matched" && (
        <div className="space-y-1 border-t border-line pt-4 text-sm">
          <p>
            <strong>Going to {match.shelterName}.</strong> <span className="text-muted">{match.reason}</span>
          </p>
          <p className="font-medium text-ok">
            {match.funded
              ? match.driverName
                ? `Trip funded. ${match.driverName} is on the way.`
                : "Trip funded. Finding a driver."
              : "Waiting for a donor to fund this trip. A driver is sent as soon as it's covered."}
          </p>
        </div>
      )}
      {match?.kind === "no_shelter" && <Notice tone="warn">No shelter can take this right now. A coordinator has been alerted.</Notice>}
    </div>
  );
}
