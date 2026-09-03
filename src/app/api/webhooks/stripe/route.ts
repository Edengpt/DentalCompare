import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { verifyStripeWebhookSignature, subscriptionCurrentPeriodEnd } from "@/lib/stripe";
import { syncStripeSubscription, recordStripeCharge, markPastDue, cancelSubscription } from "@/server/subscriptions";
import { sendPaymentFailedEmail, sendTrialEndingEmail } from "@/server/subscription-notifications";
import { trialDaysRemaining } from "@/lib/subscription";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/log";
import { asLocale } from "@/i18n/config";

export const runtime = "nodejs";

/**
 * Stripe's installed SDK types (v22, "basil"+ API versions) moved Invoice's
 * subscription reference under parent.subscription_details, to support
 * multi-item subscriptions.
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return typeof subscription === "string" ? subscription : subscription?.id;
}

/**
 * Stripe's own webhook endpoint — the counterpart to /api/webhooks/payplus,
 * but structurally different on purpose: PayPlus's IPN only ever tells us
 * "a charge happened", and OUR cron drives every other state transition.
 * Stripe tells us about every transition itself (trial started, went active,
 * failed, canceled) — this handler's whole job is translating those into
 * SubscriptionStatus via the functions in subscriptions.ts, never deciding
 * anything on its own.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  const event = verifyStripeWebhookSignature(raw, signature);

  if (!event) {
    logEvent("warn", "stripe.webhook.bad_signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const setupToken = session.metadata?.setupToken;
      const stripeSubscriptionId =
        typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
      if (!stripeSubscriptionId || !stripeCustomerId) {
        logEvent("error", "stripe.webhook.checkout_session_missing_ids", { sessionId: session.id });
        break;
      }
      const result = await syncStripeSubscription({
        stripeSubscriptionId,
        stripeCustomerId,
        status: "trialing", // Checkout with trial_period_days always starts trialing.
        // currentPeriodEnd/trialEndsAt are intentionally omitted (not passed as
        // null): we don't have real values yet, and customer.subscription.updated
        // (fired moments later, but not guaranteed to arrive after this event)
        // carries them. Omitting means "don't touch this field" rather than
        // clobbering a value that event may have already written.
        setupToken,
      });
      if (result.ok) {
        await audit({
          actor: "webhook",
          action: "subscription.stripe_checkout_completed",
          entity: "ClinicSubscription",
          entityId: result.subscriptionId,
          metadata: { stripeSubscriptionId },
        });
      } else {
        logEvent("error", "stripe.webhook.sync_failed", { stripeSubscriptionId, error: result.error });
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.created": {
      const sub = event.data.object as Stripe.Subscription;
      const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const currentPeriodEnd = subscriptionCurrentPeriodEnd(sub);
      const result = await syncStripeSubscription({
        stripeSubscriptionId: sub.id,
        stripeCustomerId,
        status: sub.status,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        // In case this event arrives before checkout.session.completed (Stripe
        // doesn't guarantee delivery order): the subscription carries its own
        // setupToken metadata (set at creation, see createSubscriptionCheckoutSession
        // in src/lib/stripe.ts), so the setupToken fallback still works here too.
        setupToken: sub.metadata?.setupToken,
      });
      if (!result.ok) {
        logEvent("error", "stripe.webhook.sync_failed", { stripeSubscriptionId: sub.id, error: result.error });
      }
      break;
    }

    case "customer.subscription.trial_will_end": {
      const sub = event.data.object as Stripe.Subscription;
      const row = await db.clinicSubscription.findUnique({
        where: { stripeSubscriptionId: sub.id },
        select: {
          plan: true,
          priceMinor: true,
          currency: true,
          dentist: { select: { clinicName: true, email: true, locale: true } },
        },
      });
      if (!row || row.priceMinor === null || row.currency === null) {
        logEvent("error", "stripe.webhook.trial_will_end_unknown_or_unpriced", { stripeSubscriptionId: sub.id });
        break;
      }
      if (!sub.trial_end) break;
      await sendTrialEndingEmail({
        email: row.dentist.email,
        clinicName: row.dentist.clinicName,
        daysRemaining: trialDaysRemaining(new Date(sub.trial_end * 1000), new Date()),
        priceMinor: row.priceMinor,
        currency: row.currency,
        plan: row.plan,
        locale: asLocale(row.dentist.locale),
        // A Stripe clinic's card is always on file before its trial even
        // starts (payment_method_collection: "always"), so there is never
        // anything left to set up — unlike PayPlus, where this same email
        // may still need to ask for a card.
        setupToken: null,
      });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubscriptionId = invoiceSubscriptionId(invoice);
      if (!stripeSubscriptionId) break;
      // Stripe's own $0 invoice at trial start (billing_reason
      // "subscription_create") is not a real charge — let
      // customer.subscription.updated own the trialing state instead of
      // flipping this row to ACTIVE with a phantom $0 "paid" charge.
      // billing_reason === "subscription_create" is unambiguous here
      // specifically because every Stripe subscription this app creates has
      // a mandatory trial (trialDays >= 1, enforced in
      // subscription-pricing.ts's parsePricingInput), so this can never
      // accidentally be a real first-invoice-with-a-genuine-0-amount case —
      // require both conditions rather than either, so a real charge is
      // never skipped.
      if (invoice.billing_reason === "subscription_create" && invoice.amount_paid === 0) break;
      const row = await db.clinicSubscription.findUnique({
        where: { stripeSubscriptionId },
        select: { id: true },
      });
      if (!row) {
        logEvent("error", "stripe.webhook.invoice_paid_unknown_subscription", { stripeSubscriptionId });
        break;
      }
      await recordStripeCharge({
        subscriptionId: row.id,
        stripeInvoiceId: invoice.id,
        amountMinor: invoice.amount_paid,
        currency: invoice.currency.toUpperCase(),
        periodStart: new Date(invoice.period_start * 1000),
        periodEnd: new Date(invoice.period_end * 1000),
      });
      await audit({
        actor: "webhook",
        action: "subscription.stripe_invoice_paid",
        entity: "ClinicSubscription",
        entityId: row.id,
        metadata: { stripeInvoiceId: invoice.id, amountMinor: invoice.amount_paid },
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubscriptionId = invoiceSubscriptionId(invoice);
      if (!stripeSubscriptionId) break;
      const row = await db.clinicSubscription.findUnique({
        where: { stripeSubscriptionId },
        select: { id: true, dentist: { select: { clinicName: true, email: true, locale: true } } },
      });
      if (!row) {
        logEvent("error", "stripe.webhook.invoice_failed_unknown_subscription", { stripeSubscriptionId });
        break;
      }
      // markPastDue returns true only the FIRST time (see subscriptions.ts) —
      // exactly the same "notify once, not on every retry" gate the PayPlus
      // renewal cron already relies on, so this mirrors that cron's own
      // firstFailure-check-then-email pattern (see
      // src/app/api/cron/renew-subscriptions/route.ts) rather than inventing
      // a second one.
      const firstFailure = await markPastDue(row.id);
      if (firstFailure) {
        await sendPaymentFailedEmail({
          email: row.dentist.email,
          clinicName: row.dentist.clinicName,
          locale: asLocale(row.dentist.locale),
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const row = await db.clinicSubscription.findUnique({
        where: { stripeSubscriptionId: sub.id },
        select: { id: true },
      });
      if (!row) {
        logEvent("error", "stripe.webhook.subscription_deleted_unknown", { stripeSubscriptionId: sub.id });
        break;
      }
      await cancelSubscription(row.id);
      await audit({
        actor: "webhook",
        action: "subscription.stripe_canceled",
        entity: "ClinicSubscription",
        entityId: row.id,
        metadata: {},
      });
      break;
    }

    default:
      // Acknowledged, ignored — Stripe sends many event types we don't act on.
      break;
  }

  return NextResponse.json({ received: true });
}
