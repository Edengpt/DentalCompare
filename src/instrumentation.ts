import * as Sentry from "@sentry/nextjs";
import { assertEnv } from "@/lib/env";
import { scrubEvent } from "@/lib/sentry-scrub";

/**
 * Server/edge startup.
 *
 * Error monitoring is a no-op until NEXT_PUBLIC_SENTRY_DSN is set, so the app
 * runs identically with Sentry unconfigured. sendDefaultPii is OFF — this is a
 * medical platform, so request bodies/headers that may carry personal data are
 * not captured, and `scrubEvent` strips addresses and phone numbers from the
 * messages we write ourselves.
 *
 * Errors we catch and log (a failed email, a failed charge) never reach
 * `onRequestError`, because nothing is thrown. The console integration forwards
 * every `console.error` on the server, so those reach Sentry too without
 * touching each call site.
 */
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (dsn && (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge")) {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
      beforeSend: scrubEvent,
      integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
    });
  }

  // After Sentry, so a failed check is itself reported. Node only: the edge
  // runtime (the proxy) doesn't read most of these.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    assertEnv();
  }
}

// Captures errors thrown in React Server Components, route handlers, etc.
export const onRequestError = Sentry.captureRequestError;
