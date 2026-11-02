import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Car, HandHeart, Store } from "lucide-react";
import { guideStart } from "@/app/actions";
import { ShapeArt } from "@/components/shape-art";
import { SubmitButton } from "@/components/submit-button";
import { Container, Kicker, Skeleton } from "@/components/ui";
import { AllPeople } from "./people";

export const metadata = { title: "Try the demo" };

const STEPS = [
  { icon: Store, title: "A restaurant posts its surplus", body: "Gemini reads it, a shelter is matched, the trip is funded and a driver is booked." },
  { icon: Car, title: "A volunteer drives it over", body: "Simulate the drive, snap the food at pickup and at drop-off." },
  { icon: HandHeart, title: "The shelter confirms", body: "One tap once the food is in the kitchen." },
  { icon: BadgeCheck, title: "PayPal pays the driver", body: "Photo, GPS and the shelter agree, so Payouts reimburses them." },
];

export default function DemoPage() {
  return (
    <Container>
      <section className="mt-10 grid overflow-hidden rounded-3xl bg-surface sm:mt-14 lg:grid-cols-[1.25fr_1fr]" aria-labelledby="guided">
        <div className="p-7 sm:p-10">
          <Kicker>Try the demo · about 2 minutes</Kicker>
          <h1 id="guided" className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Run one rescue, start to finish.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-muted">
            A guide at the bottom of the screen tells you what to do at each step and switches you to the next person when it&apos;s their turn. Real Gemini,
            real PayPal sandbox.
          </p>
          <ol className="mt-8 space-y-4">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-bg text-brand">
                  <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span>
                  <span className="block font-semibold">
                    {i + 1}. {title}
                  </span>
                  <span className="block text-sm text-muted">{body}</span>
                </span>
              </li>
            ))}
          </ol>
          <form action={guideStart} className="mt-8">
            <SubmitButton pendingText="Starting…" className="min-h-12 px-6 text-base">
              Start the guided rescue <ArrowRight className="h-4 w-4" aria-hidden />
            </SubmitButton>
          </form>
        </div>
        <ShapeArt
          src="/cutouts/rider.webp"
          alt="A volunteer rider with a delivery box on his bicycle"
          tones={["mint", "saffron", "coral"]}
          priority
          sizes="(min-width: 1024px) 460px, 90vw"
          className="hidden h-full min-h-96 overflow-hidden lg:block"
        />
      </section>

      <section className="pt-16" aria-labelledby="anyone">
        <div className="mb-8 max-w-2xl">
          <h2 id="anyone" className="font-display text-2xl font-semibold tracking-[-0.02em]">
            Or explore as anyone
          </h2>
          <p className="mt-2 text-muted">
            Every restaurant, driver, shelter and sponsor has their own private page. There are no passwords in this demo: pick a person and you&apos;re in.
          </p>
        </div>
        <Suspense fallback={<Skeleton lines={8} />}>
          <AllPeople />
        </Suspense>
      </section>

      <p className="mt-12 text-sm text-muted">
        Running operations? The{" "}
        <Link href="/coordinator" className="font-semibold text-ink underline-offset-4 hover:underline">
          coordinator console
        </Link>{" "}
        is for MealBridge staff and needs the passcode.
      </p>
    </Container>
  );
}
