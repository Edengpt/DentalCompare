import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { SubscriptionStatus } from "@/generated/prisma/enums";
import { appUrl } from "./app-url";

/**
 * Lemon Squeezy: merchant of record for clinics outside Israel. It sells the
 * subscription in its own name, so it collects and remits VAT / sales tax in
 * every country and issues the receipt — the reason it replaces Stripe there.
 *
 * Off until LEMONSQUEEZY_ENABLED is "true". The store can exist in test mode
 * long before it is approved to take real money, and until then international
 * registrations must keep going to Stripe.
 */
const API = "https://api.lemonsqueezy.com/v1";

export function isLemonSqueezyEnabled(): boolean {
  return (
    process.env.LEMONSQUEEZY_ENABLED === "true" &&
    Boolean(process.env.LEMONSQUEEZY_API_KEY) &&
    Boolean(process.env.LEMONSQUEEZY_STORE_ID) &&
    Boolean(process.env.LEMONSQUEEZY_VARIANT_MONTHLY) &&
    Boolean(process.env.LEMONSQUEEZY_VARIANT_YEARLY)
  );
}

function variantFor(plan: "MONTHLY" | "YEARLY"): string {
  const id =
    plan === "MONTHLY"
      ? process.env.LEMONSQUEEZY_VARIANT_MONTHLY
      : process.env.LEMONSQUEEZY_VARIANT_YEARLY;
  if (!id) throw new Error(`Lemon Squeezy variant for ${plan} is not configured`);
  return id;
}

async function call<T>(path: string, init: { method: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method,
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json = (await res.json().catch(() => null)) as T & { errors?: unknown };
  if (!res.ok) {
    throw new Error(`Lemon Squeezy ${init.method} ${path} failed: ${res.status} ${JSON.stringify(json?.errors ?? json)}`);
  }
  return json;
}

/**
 * A single-use discount for one founding clinic: the difference between list
 * and founding price, for as many billing months as the founding year needs.
 * The price reverts on its own when it runs out — nothing here has to
 * remember to change it.
 */
async function createFoundingDiscount(args: {
  plan: "MONTHLY" | "YEARLY";
  amountOffMinor: number;
  months: number;
}): Promise<string> {
  const code = `FOUNDING${randomBytes(4).toString("hex").toUpperCase()}`;
  await call("/discounts", {
    method: "POST",
    body: {
      data: {
        type: "discounts",
        attributes: {
          name: "Founding clinic",
          code,
          amount: args.amountOffMinor,
          amount_type: "fixed",
          duration: "repeating",
          duration_in_months: args.months,
          is_limited_to_products: true,
          is_limited_redemptions: true,
          max_redemptions: 1,
        },
        relationships: {
          store: { data: { type: "stores", id: process.env.LEMONSQUEEZY_STORE_ID } },
          variants: { data: [{ type: "variants", id: variantFor(args.plan) }] },
        },
      },
    },
  });
  return code;
}

/**
 * A hosted checkout for one clinic's subscription.
 *
 * The price is sent with the checkout (custom_price, which Lemon Squeezy
 * applies to every renewal too), so what the clinic agreed to at registration
 * is what it pays — not whatever the variant happens to say in the dashboard.
 * The setup token travels as custom data and comes back on every webhook.
 */
export async function createLemonSqueezyCheckout(args: {
  setupToken: string;
  plan: "MONTHLY" | "YEARLY";
  listPriceMinor: number;
  email: string;
  clinicName: string;
  locale: string;
  founding?: { amountOffMinor: number; months: number };
}): Promise<{ url: string }> {
  const discountCode = args.founding
    ? await createFoundingDiscount({ plan: args.plan, ...args.founding })
    : undefined;
  const base = appUrl();
  const res = await call<{ data: { attributes: { url: string } } }>("/checkouts", {
    method: "POST",
    body: {
      data: {
        type: "checkouts",
        attributes: {
          custom_price: args.listPriceMinor,
          product_options: {
            redirect_url: `${base}/${args.locale}/clinics/billing/return?token=${args.setupToken}&status=success`,
          },
          checkout_data: {
            email: args.email,
            name: args.clinicName,
            ...(discountCode ? { discount_code: discountCode } : {}),
            custom: { setup_token: args.setupToken },
          },
        },
        relationships: {
          store: { data: { type: "stores", id: process.env.LEMONSQUEEZY_STORE_ID } },
          variant: { data: { type: "variants", id: variantFor(args.plan) } },
        },
      },
    },
  });
  return { url: res.data.attributes.url };
}

/**
 * Moves a subscription's trial end. The variant carries one fixed trial
 * length, but ours is per clinic (an upgrading free clinic gets a short grace
 * period, and the admin can change the trial for new clinics), so the
 * webhook corrects it right after the subscription is created.
 */
export async function setLemonSqueezyTrialEnd(subscriptionId: string, endsAt: Date): Promise<void> {
  await call(`/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    body: {
      data: { type: "subscriptions", id: subscriptionId, attributes: { trial_ends_at: endsAt.toISOString() } },
    },
  });
}

/** Ends a trial early — the outcome-based trial's "convert now" for this provider. */
export async function endLemonSqueezyTrialNow(subscriptionId: string): Promise<void> {
  // Lemon Squeezy only takes a future date; a minute ahead is "now".
  await setLemonSqueezyTrialEnd(subscriptionId, new Date(Date.now() + 60_000));
}

/** Verifies the X-Signature header: hex HMAC-SHA256 of the raw body. */
export function verifyLemonSqueezySignature(raw: string, signature: string | null): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Lemon Squeezy's subscription status in our terms. "cancelled" means the
 * clinic cancelled but the paid period is still running; it only stops being
 * listed at "expired".
 */
export function mapLemonSqueezyStatus(status: string): SubscriptionStatus {
  switch (status) {
    case "on_trial":
      return "TRIALING";
    case "active":
    case "cancelled":
      return "ACTIVE";
    case "expired":
      return "CANCELED";
    case "past_due":
    case "unpaid":
    case "paused":
    default:
      return "PAST_DUE";
  }
}
