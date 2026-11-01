"use client";

import { useActionState } from "react";
import { postSurplus, type PostSurplusResult } from "@/app/actions";
import { PhotoInput } from "@/components/photo-input";
import { Badge, buttonClass } from "@/components/ui";

export function PostSurplusForm({ restaurantId }: { restaurantId: string }) {
  const [result, action, pending] = useActionState<PostSurplusResult | null, FormData>(postSurplus, null);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <form action={action} className="space-y-3" key={result?.ok ? "done" : "form"}>
        <input type="hidden" name="restaurantId" value={restaurantId} />
        <PhotoInput label="Snap the surplus" />
        <textarea
          name="notes"
          rows={3}
          placeholder='Optional note, any language. e.g. "about 40 portions veg biryani, kept hot, ready till 10pm"'
          className="w-full rounded-xl border border-line bg-paper p-3 text-sm"
        />
        <button type="submit" disabled={pending} className={`${buttonClass.primary} w-full py-3 text-base`}>
          {pending ? "Reading your food and finding a shelter…" : "Post surplus"}
        </button>
        <p className="text-xs text-muted">Free for restaurants. We find a shelter and a driver, and the trip is funded before anyone drives.</p>
      </form>

      <div aria-live="polite">
        {!result && !pending && (
          <div className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
            One photo is enough. The AI fills in the listing; food-safety rules check it; a shelter and driver are matched.
          </div>
        )}
        {pending && <div className="h-40 animate-pulse rounded-xl bg-line" />}
        {result && !pending && !result.ok && (
          <div className="rounded-xl border border-berry/40 bg-berry-soft p-4 text-sm text-berry">{result.error}</div>
        )}
        {result && !pending && result.ok && <ResultCard result={result} />}
      </div>
    </div>
  );
}

function ResultCard({ result }: { result: Extract<PostSurplusResult, { ok: true }> }) {
  const { safety, match } = result;
  return (
    <div className="space-y-3 rounded-xl border border-line bg-paper p-4">
      <div className="flex items-center gap-2">
        <span className="font-display text-lg font-semibold">{result.summary}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {safety.status === "approved" && <Badge tone="leaf">Passed food-safety rules</Badge>}
        {safety.status === "review" && <Badge tone="saffron">A coordinator will check this first</Badge>}
        {safety.status === "rejected" && <Badge tone="berry">Can&apos;t be rescued safely</Badge>}
        {result.mode === "demo" && <Badge tone="saffron">Read from your note (AI unavailable)</Badge>}
      </div>
      {safety.reasons.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-muted">
          {safety.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
      {match?.kind === "matched" && (
        <div className="space-y-1 rounded-lg bg-leaf-soft p-3 text-sm">
          <p>
            <strong>Going to {match.shelterName}.</strong> {match.reason}
          </p>
          <p>
            {match.funded
              ? match.driverName
                ? `Trip funded. ${match.driverName} is on the way.`
                : "Trip funded. Finding a driver."
              : "Waiting for a donor to fund this trip. We'll dispatch as soon as it's covered."}
          </p>
        </div>
      )}
      {match?.kind === "no_shelter" && (
        <p className="rounded-lg bg-saffron-soft p-3 text-sm">No shelter can take this right now. A coordinator has been alerted.</p>
      )}
    </div>
  );
}
