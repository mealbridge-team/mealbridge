"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-renders the server components every so often, so a screen notices what other people did
// (a shelter confirming, a driver picking up) without a manual reload. Paused in hidden tabs.
export function AutoRefresh({ everyMs = 10_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => window.clearInterval(id);
  }, [router, everyMs]);
  return null;
}
