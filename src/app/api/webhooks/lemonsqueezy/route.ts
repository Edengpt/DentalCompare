import { NextResponse } from "next/server";
import { verifyLemonSqueezySignature, setLemonSqueezyTrialEnd } from "@/lib/lemonsqueezy";
import {
  syncLemonSqueezySubscription,
  recordLemonSqueezyCharge,
  markPastDue,
  cancelSubscription,
} from "@/server/subscriptions";
import { sendPaymentFailedEmail } from "@/server/subscription-notifications";
import { nextPeriodEnd, trialEndFrom } from "@/lib/subscription";
import type { SubscriptionPlanType } from "@/lib/constants";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/log";
import { asLocale } from "@/i18n/config";

export const runtime = "nodejs";

const DAY_MS = 24 * 60 * 60 * 1000;

type SubscriptionAttributes = {
  customer_id: number;
  status: string;
  trial_ends_at: string | null;
  renews_at: string | null;
  ends_at: string | null;
};

type InvoiceAttributes = {
  subscription_id: number;
  billing_reason: string;
  total: number;
  currency: string;
  status: string;
  created_at: string;
};

type LemonSqueezyEvent = {
  meta: { event_name: string; custom_data?: { setup_token?: string } };
  data: { id: string; type: string; attributes: Record<string, unknown> };
};

const toDate = (iso: string | null | undefined) => (iso ? new Date(iso) : null);

/**
 * Lemon Squeezy's webhook — the same job as /api/webhooks/stripe: translate
 * what the provider says happened into our subscription row, never decide
 * billing on its own. Lemon Squeezy charges, retries and cancels by itself.
 *
 * Unknown subscriptions answer 500 on purpose: an invoice can arrive before
 * the subscription_created that links it, and a failed delivery is retried.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyLemonSqueezySignature(raw, req.headers.get("x-signature"))) {
    logEvent("warn", "lemonsqueezy.webhook.bad_signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: LemonSqueezyEvent;
  try {
    event = JSON.parse(raw) as LemonSqueezyEvent;
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }
  const name = event.meta.event_name;

  switch (name) {
    case "subscription_created":
    case "subscription_updated":
    case "subscription_cancelled":
    case "subscription_resumed":
    case "subscription_paused":
    case "subscription_unpaused": {
      const a = event.data.attributes as unknown as SubscriptionAttributes;
      const result = await syncLemonSqueezySubscription({
        lemonSqueezySubscriptionId: event.data.id,
        lemonSqueezyCustomerId: String(a.customer_id),
        status: a.status,
        // A cancelled subscription has no next renewal; it runs until ends_at.
        currentPeriodEnd: toDate(a.renews_at ?? a.ends_at),
        trialEndsAt: toDate(a.trial_ends_at),
        setupToken: event.meta.custom_data?.setup_token,
      });
      if (!result.ok) {
        logEvent("error", "lemonsqueezy.webhook.sync_failed", { subscriptionId: event.data.id, error: result.error });
        return new NextResponse("Unknown subscription", { status: 500 });
      }
      if (name === "subscription_created") {
        await alignTrial(result.subscriptionId, event.data.id, a);
        await audit({
          actor: "webhook",
          action: "subscription.lemonsqueezy_created",
          entity: "ClinicSubscription",
          entityId: result.subscriptionId,
          metadata: { lemonSqueezySubscriptionId: event.data.id },
        });
      }
      break;
    }

    case "subscription_payment_success":
    case "subscription_payment_recovered": {
      const a = event.data.attributes as unknown as InvoiceAttributes;
      // The $0 invoice at the start of a trial is not a payment.
      if (a.status !== "paid" || a.total === 0) break;
      const row = await db.clinicSubscription.findUnique({
        where: { lemonSqueezySubscriptionId: String(a.subscription_id) },
        select: { id: true, plan: true },
      });
      if (!row) {
        logEvent("error", "lemonsqueezy.webhook.invoice_unknown_subscription", { subscriptionId: a.subscription_id });
        return new NextResponse("Unknown subscription", { status: 500 });
      }
      const periodStart = new Date(a.created_at);
      await recordLemonSqueezyCharge({
        subscriptionId: row.id,
        lemonSqueezyInvoiceId: event.data.id,
        amountMinor: a.total,
        currency: a.currency.toUpperCase(),
        periodStart,
        periodEnd: nextPeriodEnd(periodStart, row.plan as SubscriptionPlanType),
      });
      await audit({
        actor: "webhook",
        action: "subscription.lemonsqueezy_invoice_paid",
        entity: "ClinicSubscription",
        entityId: row.id,
        metadata: { lemonSqueezyInvoiceId: event.data.id, amountMinor: a.total },
      });
      break;
    }

    case "subscription_payment_failed": {
      const a = event.data.attributes as unknown as InvoiceAttributes;
      const row = await db.clinicSubscription.findUnique({
        where: { lemonSqueezySubscriptionId: String(a.subscription_id) },
        select: { id: true, dentist: { select: { clinicName: true, email: true, locale: true } } },
      });
      if (!row) {
        logEvent("error", "lemonsqueezy.webhook.failed_unknown_subscription", { subscriptionId: a.subscription_id });
        return new NextResponse("Unknown subscription", { status: 500 });
      }
      // Email once per failure streak, like the Stripe and PayPlus paths.
      if (await markPastDue(row.id)) {
        await sendPaymentFailedEmail({
          email: row.dentist.email,
          clinicName: row.dentist.clinicName,
          locale: asLocale(row.dentist.locale),
        });
      }
      break;
    }

    case "subscription_expired": {
      const row = await db.clinicSubscription.findUnique({
        where: { lemonSqueezySubscriptionId: event.data.id },
        select: { id: true },
      });
      if (!row) {
        logEvent("error", "lemonsqueezy.webhook.expired_unknown", { subscriptionId: event.data.id });
        break;
      }
      await cancelSubscription(row.id);
      await audit({
        actor: "webhook",
        action: "subscription.lemonsqueezy_expired",
        entity: "ClinicSubscription",
        entityId: row.id,
        metadata: {},
      });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}

/**
 * The product's variant has one fixed trial; this clinic's trial length is
 * ours (trialDays on the row). Set it once, at creation, when they differ by
 * more than a day.
 */
async function alignTrial(subscriptionId: string, lsId: string, a: SubscriptionAttributes): Promise<void> {
  if (a.status !== "on_trial" || !a.trial_ends_at) return;
  const row = await db.clinicSubscription.findUnique({
    where: { id: subscriptionId },
    select: { trialDays: true },
  });
  if (!row) return;
  const wanted = trialEndFrom(new Date(), row.trialDays);
  if (Math.abs(wanted.getTime() - new Date(a.trial_ends_at).getTime()) <= DAY_MS) return;
  try {
    await setLemonSqueezyTrialEnd(lsId, wanted);
    await db.clinicSubscription.update({ where: { id: subscriptionId }, data: { trialEndsAt: wanted } });
  } catch (err) {
    logEvent("error", "lemonsqueezy.webhook.trial_align_failed", {
      subscriptionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
