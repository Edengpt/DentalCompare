"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 2000;
// A minute of watching. Past that, delivery has stalled rather than slowed, and
// the page's own two-minute fallback (on the next visit) or the retry cron is
// what finishes it — refreshing forever would only burn requests.
const MAX_REFRESHES = 30;

/**
 * Re-renders the success page every couple of seconds while the request is
 * still being delivered in the background, so "sending" turns into "sent"
 * without the patient having to reload.
 */
export function RefreshWhileSending() {
  const router = useRouter();

  useEffect(() => {
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (count > MAX_REFRESHES) {
        clearInterval(timer);
        return;
      }
      router.refresh();
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [router]);

  return null;
}
