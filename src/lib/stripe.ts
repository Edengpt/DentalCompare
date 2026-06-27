import "server-only";
import Stripe from "stripe";

/**
 * Test mode lets the full request flow run end-to-end without a real payment
 * provider — needed because Stripe isn't available to Israeli businesses yet.
 * On by default whenever no Stripe secret is configured; can be forced with
 * PAYMENTS_TEST_MODE=true. Swap in a real provider later by setting the keys.
 */
export function isPaymentsTestMode(): boolean {
  return process.env.PAYMENTS_TEST_MODE === "true" || !process.env.STRIPE_SECRET_KEY;
}

let client: Stripe | null = null;

/**
 * Lazily-instantiated Stripe client. Throwing only on first use (rather than at
 * import time) keeps the app bootable in environments where payments aren't
 * configured yet — mirrors the DATABASE_URL handling in `@/lib/db`.
 */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  client = new Stripe(key);
  return client;
}
