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
}): Promise<{ url: string }> {
  const stripe = getStripeClient();
  const base = appUrl();
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
    subscription_data: {
      trial_period_days: args.trialDays,
      metadata: { setupToken: args.setupToken },
    },
    metadata: { setupToken: args.setupToken },
    success_url: `${base}/clinics/billing/return?token=${args.setupToken}&status=success`,
    cancel_url: `${base}/clinics/billing/return?token=${args.setupToken}&status=failure`,
  });
  if (!session.url) throw new Error("Stripe checkout session has no url");
  return { url: session.url };
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

/** Fetches the live Stripe Subscription for a given id — used by the return-page fallback and the webhook handler alike, so both read the exact same shape. */
export async function retrieveStripeSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
  return getStripeClient().subscriptions.retrieve(stripeSubscriptionId);
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
