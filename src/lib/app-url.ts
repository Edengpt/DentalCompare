/**
 * The app's public base URL (no trailing slash), used for links in transactional
 * emails and payment redirect URLs.
 *
 * A missing NEXT_PUBLIC_APP_URL in production is a misconfiguration that would
 * ship broken `localhost` links to real users (dentist quote links, patient
 * comparison links, PayPlus return URLs). We fail loudly there instead of
 * silently falling back. In dev/test the localhost default is the intended value.
 */
export function appUrl(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (base) return base;
  // On Vercel (preview or production) without an explicit canonical URL, fall
  // back to the deployment's own URL so links resolve instead of crashing.
  const vercelUrl = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercelUrl) return `https://${vercelUrl}`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set in production — refusing to emit localhost links.",
    );
  }
  return "http://localhost:3000";
}
