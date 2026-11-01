"use client";

import { useActionState } from "react";
import { postSurplus, type PostSurplusResult } from "@/app/actions";
import { PhotoInput } from "@/components/photo-input";
import { Badge, buttonClass, inputClass } from "@/components/ui";

const EXAMPLES = [
  "About 40 portions of veg biryani, kept hot, ready till 10pm",
  "Two trays of chicken teriyaki and rice, cooked an hour ago, in the warmer",
  "25 bean and cheese burritos, made at 6, kept hot",
];

export function PostSurplusForm({ restaurantId }: { restaurantId: string }) {
  const [result, action, pending] = useActionState<PostSurplusResult | null, FormData>(postSurplus, null);

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-3" key={result?.ok ? "done" : "form"}>
        <input type="hidden" name="restaurantId" value={restaurantId} />
        <PhotoInput label="Snap the food" />
        <textarea name="notes" rows={2} placeholder="Or describe it, in any language" className={inputClass} />
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Need an example note?</summary>
          <ul className="mt-1 list-disc pl-5">
            {EXAMPLES.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </details>
        <button type="submit" disabled={pending} className={`${buttonClass.accent} w-full py-3.5 text-base`}>
          {pending ? "Reading the food and finding a shelter…" : "Post surplus"}
        </button>
        <p className="text-center text-xs text-muted">Always free to post. The trip is funded before a driver moves.</p>
      </form>

      <div aria-live="polite">
        {pending && <div className="h-28 animate-pulse rounded-2xl bg-cream" />}
        {result && !pending && !result.ok && <div className="rounded-2xl bg-berry-soft p-4 text-sm text-berry">{result.error}</div>}
        {result && !pending && result.ok && <ResultCard result={result} />}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: Extract<PostSurplusResult, { ok: true }> }) {
  const { safety, match } = result;
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-cream p-4">
      <p className="font-display text-lg font-semibold">{result.summary}</p>
      <div className="flex flex-wrap gap-2">
        {safety.status === "approved" && <Badge tone="leaf">Passed food-safety rules</Badge>}
        {safety.status === "review" && <Badge tone="saffron">A coordinator will check this first</Badge>}
        {safety.status === "rejected" && <Badge tone="berry">Can&apos;t be rescued safely</Badge>}
        {result.mode === "demo" ? <Badge tone="saffron">Read from your note (AI unavailable)</Badge> : <Badge tone="sky">Read by Gemini</Badge>}
      </div>
      {safety.reasons.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-muted">
          {safety.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {match?.kind === "matched" && (
        <div className="space-y-1 rounded-xl bg-leaf-soft p-3 text-sm">
          <p>
            <strong>Going to {match.shelterName}.</strong> {match.reason}
          </p>
          <p>
            {match.funded
              ? match.driverName
                ? `Trip funded. ${match.driverName} is on the way.`
                : "Trip funded. Finding a driver."
              : "Waiting for a donor to fund this trip. A driver is sent as soon as it's covered."}
          </p>
        </div>
      )}
      {match?.kind === "no_shelter" && (
        <p className="rounded-xl bg-saffron-soft p-3 text-sm">No shelter can take this right now. A coordinator has been alerted.</p>
      )}
    </div>
  );
}
