import Link from "next/link";
import { aiMode } from "@/ai/model";
import { paypalMode } from "@/paypal/client";

const NAV = [
  { href: "/restaurant", label: "Restaurant" },
  { href: "/driver", label: "Driver" },
  { href: "/shelter", label: "Shelter" },
  { href: "/coordinator", label: "Coordinator" },
  { href: "/donate", label: "Donate" },
];

export function SiteHeader() {
  const paypal = paypalMode();
  const ai = aiMode();
  return (
    <header className="border-b border-line bg-paper">
      <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
        <Link href="/" className="font-display text-xl font-semibold text-leaf">
          MealBridge
        </Link>
        <nav className="flex flex-wrap gap-1 text-sm">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3 py-1 text-muted hover:bg-leaf-soft hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex gap-2 text-xs">
          <span className={`rounded-full px-2 py-0.5 ${paypal === "sandbox" ? "bg-sky-soft text-sky" : "bg-saffron-soft text-saffron"}`}>
            PayPal {paypal === "sandbox" ? "sandbox" : "mock"}
          </span>
          <span className={`rounded-full px-2 py-0.5 ${ai === "gemini" ? "bg-leaf-soft text-leaf" : "bg-saffron-soft text-saffron"}`}>
            AI {ai === "gemini" ? "Gemini" : "demo rules"}
          </span>
        </div>
      </div>
    </header>
  );
}
