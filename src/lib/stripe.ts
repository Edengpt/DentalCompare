import "server-only";
import Stripe from "stripe";
import { appUrl } from "@/lib/app-url";
import type { SubscriptionStatus } from "@/generated/prisma/enums";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

let cachedClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!cachedClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    cachedClient = new Stripe(key);
  }
  return cachedClient;
}

/**
 * The one place Stripe's own subscription-status vocabulary becomes ours.
 * incomplete/paused map to PAST_DUE rather than a silent ACTIVE — both mean
 * "this subscription needs attention", and PAST_DUE is exactly the status
 * this app already has a notification path for (markPastDue's caller sends
 * sendPaymentFailedEmail).
 */
export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "TRIALING";
    case "active":
      return "ACTIVE";
    case "past_due":
      return "PAST_DUE";
    case "canceled":
    case "unpaid":
    case "incomplete_expired":
      return "CANCELED";
    case "incomplete":
    case "paused":
    default:
      return "PAST_DUE";
  }
}

/**
 * Creates a Stripe Checkout Session for a new subscription. The price is
 * built inline (price_data) from whatever SubscriptionPricing says right
 * now, rather than a pre-created, reusable Stripe Price object — this is
 * what makes an admin-editable price actually take effect on the very next
 * registration without any Stripe-dashboard bookkeeping. Once a session
 * completes, the resulting Stripe Subscription keeps billing at whatever
 * amount was passed here, unaffected by a later SubscriptionPricing edit —
 * the same snapshot-at-creation guarantee priceMinor/currency already give
 * PayPlus subscriptions.
 *
 * payment_method_collection: "always" + trial_period_days together are what
 * make this "card required now, first charge only when the trial ends" —
 * Stripe validates and saves the card via a $0 SetupIntent at checkout, and
 * schedules the real charge automatically.
 */
export async function createSubscriptionCheckoutSession(args: {
  setupToken: string;
  amountMinor: number;
  currency: string;
  trialDays: number;
  intervalMonths: 1 | 12;
  clinicName: string;
  email: string;
  itemName: string;
  /**
   * Founding offer: amountMinor stays the list price and a repeating coupon
   * takes the difference off, so the price reverts on its own when the coupon
   * runs out — nothing on our side has to remember to change it.
   */
  discount?: { amountOffMinor: number; months: number };
}): Promise<{ url: string }> {
  const stripe = getStripeClient();
  const base = appUrl();
  const coupon = args.discount
    ? await stripe.coupons.create({
        amount_off: args.discount.amountOffMinor,
        currency: args.currency.toLowerCase(),
        duration: "repeating",
        duration_in_months: args.discount.months,
        name: "Founding clinic",
      })
    : null;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: args.email,
    payment_method_collection: "always",
    line_items: [
      {
        price_data: {
          currency: args.currency.toLowerCase(),
          unit_amount: args.amountMinor,
          recurring: { interval: args.intervalMonths === 12 ? "year" : "month" },
          product_data: { name: args.itemName },
        },
        quantity: 1,
      },
    ],
    ...(coupon ? { discounts: [{ coupon: coupon.id }] } : {}),
    subscription_data: {
      // Stripe rejects 0; no trial is expressed by leaving it out.
      ...(args.trialDays > 0 ? { trial_period_days: args.trialDays } : {}),
      metadata: { setupToken: args.setupToken },
    },
    metadata: { setupToken: args.setupToken },
    success_url: `${base}/clinics/billing/return?token=${args.setupToken}&status=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/clinics/billing/return?token=${args.setupToken}&status=failure`,
  });
  if (!session.url) throw new Error("Stripe checkout session has no url");
  return { url: session.url };
}

/**
 * stripe@22.6.1 moved Subscription.current_period_end onto the subscription's
 * line items (multi-item-subscription support). Every subscription this app
 * creates has exactly one item (see createSubscriptionCheckoutSession above),
 * so the first item's period is the subscription's period.
 */
export function subscriptionCurrentPeriodEnd(sub: Stripe.Subscription): number | null {
  return sub.items.data[0]?.current_period_end ?? null;
}

/**
 * Verifies and parses a Stripe webhook payload. Returns null on any failure
 * (missing secret, missing signature header, bad signature) — the caller
 * treats null exactly like an invalid PayPlus IPN signature: a 401, nothing
 * else happens.
 */
export function verifyStripeWebhookSignature(rawBody: string, signature: string | null): Stripe.Event | null {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return null;
  try {
    return getStripeClient().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return null;
  }
}

/** Fetches a Checkout Session, expanding its subscription — used by the return-page fallback when the webhook hasn't landed yet. */
export async function retrieveCheckoutSessionWithSubscription(
  sessionId: string,
): Promise<Stripe.Checkout.Session & { subscription: Stripe.Subscription | null }> {
  const session = await getStripeClient().checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });
  return session as Stripe.Checkout.Session & { subscription: Stripe.Subscription | null };
}

/**
 * Ends a Stripe subscription's trial immediately instead of waiting for its
 * scheduled trial_period_days to elapse. Stripe then invoices right away —
 * the existing webhook handler (customer.subscription.updated, invoice.paid)
 * picks up the resulting state change exactly as it would for a trial that
 * ran its full calendar length, so nothing else needs to change to make this
 * work.
 */
export async function endStripeTrialNow(stripeSubscriptionId: string): Promise<void> {
  await getStripeClient().subscriptions.update(stripeSubscriptionId, {
    trial_end: "now",
    proration_behavior: "none",
  });
}
