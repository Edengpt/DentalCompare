import * as Sentry from "@sentry/nextjs";

/**
 * Browser error monitoring. No-op until NEXT_PUBLIC_SENTRY_DSN is set.
 * sendDefaultPii is OFF (medical platform).
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}
