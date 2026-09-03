import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { verifyStripeWebhookSignature } from "@/lib/stripe";
import { syncStripeSubscription, recordStripeCharge, markPastDue, cancelSubscription } from "@/server/subscriptions";
import { sendPaymentFailedEmail } from "@/server/subscription-notifications";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/log";
import { asLocale } from "@/i18n/config";

export const runtime = "nodejs";

/**
 * Stripe's installed SDK types (v22, "basil"+ API versions) moved billing-period
 * fields off Subscription onto its line items, and moved Invoice's subscription
 * reference under parent.subscription_details — both to support multi-item
 * subscriptions. Every subscription this app creates has exactly one line item
 * (see createSubscriptionCheckoutSession), so the first item's period is the
 * subscription's period.
 */
function subscriptionCurrentPeriodEnd(sub: Stripe.Subscription): number | null {
  return sub.items.data[0]?.current_period_end ?? null;
}

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
        logEvent("error", "stripe.webhook.checkout_session_missing_ids", { setupToken });
        break;
      }
      const result = await syncStripeSubscription({
        stripeSubscriptionId,
        stripeCustomerId,
        status: "trialing", // Checkout with trial_period_days always starts trialing.
        currentPeriodEnd: null,
        trialEndsAt: null, // customer.subscription.updated (fired moments later) carries the real trial_end.
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
      await syncStripeSubscription({
        stripeSubscriptionId: sub.id,
        stripeCustomerId,
        status: sub.status,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000) : null,
        trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
      });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubscriptionId = invoiceSubscriptionId(invoice);
      if (!stripeSubscriptionId) break;
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
