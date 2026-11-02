import { Suspense } from "react";
import Link from "next/link";
import { Container, Kicker, Skeleton } from "@/components/ui";
import { AllPeople } from "./people";

export const metadata = { title: "Try the demo" };

export default function DemoPage() {
  return (
    <Container>
      <header className="max-w-2xl pb-10 pt-12 sm:pt-16">
        <Kicker>Try the demo</Kicker>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Sign in as anyone in the chain.</h1>
        <p className="mt-4 text-lg leading-relaxed text-muted">
          Every restaurant, driver, shelter and sponsor has their own private page. No passwords in this demo: pick a person and you&apos;re in. To follow one
          rescue end to end, start as a restaurant; each step tells you who to switch to next.
        </p>
      </header>
      <Suspense fallback={<Skeleton lines={8} />}>
        <AllPeople />
      </Suspense>
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
