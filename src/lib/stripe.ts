import "server-only";
import Stripe from "stripe";

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
