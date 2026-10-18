/**
 * Redacts personal data from a Sentry event before it leaves the server or the
 * browser. `sendDefaultPii: false` keeps request bodies and headers out, but not
 * the text we write ourselves: many caught errors are logged as
 * "Failed to send … email to <address>", and those messages now reach Sentry
 * through the console integration. This is a medical platform — an address or
 * phone number tied to a failure is personal data and has no debugging value
 * that an id doesn't give.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// Phones are stored in E.164 (+972…), so a leading + is the signal. Without it,
// dates, amounts and ids would be masked too and the event would be useless.
const PHONE = /\+\d[\d\s().-]{7,}\d/g;

export function scrubText(text: string): string {
  return text.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}

function scrubDeep(value: unknown, depth = 0): unknown {
  if (depth > 6) return value;
  if (typeof value === "string") return scrubText(value);
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubDeep(v, depth + 1)]));
  }
  return value;
}

/** Use as Sentry's `beforeSend`. Generic so it fits every runtime's event type. */
export function scrubEvent<T extends object>(event: T): T {
  return scrubDeep(event) as T;
}
