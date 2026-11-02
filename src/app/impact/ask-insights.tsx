"use client";

import { useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { buttonClass, inputClass } from "@/components/ui";

const STARTERS = [
  "What's happening on the road tonight?",
  "Which area relies most on donors?",
  "Who delivered the most meals?",
  "Where did the money come from?",
];

type Exchange = { question: string; answer?: string; error?: string };

export function AskInsights() {
  const [draft, setDraft] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const busy = history.at(-1)?.answer === undefined && history.at(-1)?.error === undefined && history.length > 0;

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setDraft("");
    setHistory((h) => [...h.slice(-3), { question: q }]);
    let result: Exchange = { question: q };
    try {
      const res = await fetch("/api/insights/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
      const body = (await res.json()) as { answer?: string; error?: string };
      result = res.ok && body.answer ? { question: q, answer: body.answer } : { question: q, error: body.error ?? "Something went wrong. Try again." };
    } catch {
      result = { question: q, error: "Couldn't reach the Insights agent. Check your connection and try again." };
    }
    setHistory((h) => [...h.slice(0, -1), result]);
  }

  return (
    <div className="space-y-5">
      {history.length > 0 && (
        <ol className="space-y-4" aria-live="polite">
          {history.map((x, i) => (
            <li key={i} className="space-y-2">
              <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-on-brand">{x.question}</p>
              <div className="flex max-w-[92%] gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand" aria-hidden>
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                {x.answer ? (
                  <p className="text-[15px] leading-relaxed">{x.answer}</p>
                ) : x.error ? (
                  <p className="text-[15px] leading-relaxed text-bad">{x.error}</p>
                ) : (
                  <p className="flex items-center gap-1.5 pt-2" aria-label="Thinking">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap gap-2">
        {STARTERS.map((s) => (
          <button key={s} type="button" disabled={busy} onClick={() => ask(s)} className="min-h-9 rounded-full border border-line bg-bg px-3.5 text-sm text-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-50">
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className="flex gap-2"
      >
        <label htmlFor="ask-insights" className="sr-only">
          Ask about the numbers
        </label>
        <input
          id="ask-insights"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask anything about meals, drivers or money"
          maxLength={400}
          autoComplete="off"
          className={`${inputClass} flex-1`}
        />
        <button type="submit" disabled={busy || !draft.trim()} className={`${buttonClass.primary} w-11 px-0`} aria-label="Ask">
          <ArrowUp className="h-4 w-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
