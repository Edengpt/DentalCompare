import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "@/lib/sentry-scrub";

/**
 * Browser error monitoring. No-op until NEXT_PUBLIC_SENTRY_DSN is set.
 * sendDefaultPii is OFF (medical platform), and personal data is scrubbed from
 * messages before they are sent.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
  });
}
