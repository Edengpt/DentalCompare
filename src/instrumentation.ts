import * as Sentry from "@sentry/nextjs";

/**
 * Server/edge error monitoring. No-op until NEXT_PUBLIC_SENTRY_DSN is set, so the
 * app runs identically with Sentry unconfigured. sendDefaultPii is OFF — this is
 * a medical platform, so request bodies/headers that may carry personal data are
 * not captured.
 */
export async function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }
}

// Captures errors thrown in React Server Components, route handlers, etc.
export const onRequestError = Sentry.captureRequestError;
