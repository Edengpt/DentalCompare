import { getDictionary } from "@/i18n/get-dictionary";
import { getRequestLocale } from "@/i18n/request-locale";
import "server-only";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type { SubscriptionProvider, SubscriptionTier } from "@/generated/prisma/enums";
import type { SubscriptionPlanType } from "@/lib/constants";
import { nextPeriodEnd } from "@/lib/subscription";
import { mapStripeSubscriptionStatus } from "@/lib/stripe";
import type Stripe from "stripe";
import { billingBlocker } from "@/lib/subscription";
import { chargeByToken } from "@/lib/payplus";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/log";
import { asLocale } from "@/i18n/config";
import { format } from "@/i18n/format";
import { sendPaymentFailedEmail, sendTrialUnbilledAdminEmail } from "@/server/subscription-notifications";

export async function createPendingSubscription(
  args: {
    dentistId: string;
    plan: SubscriptionPlanType;
    setupToken: string;
    priceMinor: number;
    currency: string;
    trialDays: number;
    trialRequestCap: number;
    provider: SubscriptionProvider;
    tier: SubscriptionTier;
  },
  client: Prisma.TransactionClient | typeof db = db,
): Promise<void> {
  await client.clinicSubscription.create({
    data: {
      dentistId: args.dentistId,
      plan: args.plan,
      priceMinor: args.priceMinor,
      currency: args.currency,
      trialDays: args.trialDays,
      trialRequestCap: args.trialRequestCap,
      setupToken: args.setupToken,
      status: "PENDING",
      provider: args.provider,
      tier: args.tier,
    },
  });
}

/**
 * Idempotently activates a subscription after its first paid charge: stores the
 * recurring token, opens the first paid period, and records a PAID charge. Safe
 * to call from both the webhook and the return page.
 */
export async function activateSubscriptionBySetupToken(args: {
  setupToken: string;
  transactionUid: string;
  recurringToken?: string;
  customerUid?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = (await getDictionary(await getRequestLocale())).errors;
  const sub = await db.clinicSubscription.findUnique({
    where: { setupToken: args.setupToken },
    select: {
      id: true,
      plan: true,
      priceMinor: true,
      currency: true,
      status: true,
      recurringToken: true,
    },
  });
  if (!sub) return { ok: false, error: e.subscriptionNotFound };

  // Backfill the stored-card token if a later caller carries it and we activated
  // earlier without it — e.g. the return page (getPageRequestStatus) activates
  // first with only a transactionUid, then the IPN arrives with the token. Without
  // this, the renewal cron would never see a recurringToken and never renew.
  if (args.recurringToken && !sub.recurringToken) {
    await db.clinicSubscription.update({
      where: { id: sub.id },
      data: {
        recurringToken: args.recurringToken,
        payplusCustomerUid: args.customerUid ?? undefined,
      },
    });
  }

  // Idempotency: if we've already recorded this transaction, activation is done.
  const existing = await db.subscriptionCharge.findUnique({
    where: { payplusTransactionUid: args.transactionUid },
    select: { id: true },
  });
  if (existing) return { ok: true };

  // Refuse to record a charge for an amount we can't read — a 0 here would
  // mark the period paid while collecting nothing.
  if (sub.priceMinor === null || sub.currency === null) {
    console.error("activateSubscription: subscription has no price", { subscriptionId: sub.id });
    return { ok: false, error: e.subscriptionMisconfigured };
  }
  const priceMinor = sub.priceMinor;
  const currency = sub.currency;

  const now = new Date();
  const periodEnd = nextPeriodEnd(now, sub.plan as SubscriptionPlanType);

  await db.$transaction([
    db.clinicSubscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        recurringToken: args.recurringToken ?? undefined,
        payplusCustomerUid: args.customerUid ?? undefined,
        currentPeriodEnd: periodEnd,
        lastChargeAt: now,
      },
    }),
    db.subscriptionCharge.create({
      data: {
        subscriptionId: sub.id,
        amountMinor: priceMinor,
        currency,
        status: "PAID",
        payplusTransactionUid: args.transactionUid,
        periodStart: now,
        periodEnd,
        paidAt: now,
      },
    }),
  ]);
  return { ok: true };
}

export async function recordRenewalCharge(args: {
  subscriptionId: string;
  transactionUid: string;
  amountMinor: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<void> {
  const now = new Date();
  await db.$transaction([
    db.clinicSubscription.update({
      where: { id: args.subscriptionId },
      data: {
        status: "ACTIVE",
        currentPeriodEnd: args.periodEnd,
        lastChargeAt: now,
        // A successful charge resets the failure-notification gate so a future
        // failure notifies again.
        paymentFailedNotifiedAt: null,
      },
    }),
    db.subscriptionCharge.create({
      data: {
        subscriptionId: args.subscriptionId,
        amountMinor: args.amountMinor,
        currency: args.currency,
        status: "PAID",
        payplusTransactionUid: args.transactionUid,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        paidAt: now,
      },
    }),
  ]);
}

/**
 * Marks a subscription PAST_DUE. Returns true only the FIRST time (stamping
 * paymentFailedNotifiedAt) so the caller sends the "charge failed" email once,
 * not on every daily retry within the grace window.
 */
export async function markPastDue(subscriptionId: string): Promise<boolean> {
  const firstTime = await db.clinicSubscription.updateMany({
    where: { id: subscriptionId, paymentFailedNotifiedAt: null },
    data: { status: "PAST_DUE", paymentFailedNotifiedAt: new Date() },
  });
  if (firstTime.count === 1) return true;
  // Already notified — just ensure the status is PAST_DUE.
  await db.clinicSubscription.update({
    where: { id: subscriptionId },
    data: { status: "PAST_DUE" },
  });
  return false;
}

/**
 * Records that a free trial ran out with no way to charge it, and returns true
 * only the FIRST time — the caller alerts once, not on every daily cron run.
 *
 * The status deliberately stays TRIALING: the clinic keeps its listing and keeps
 * receiving leads, because it should not lose the platform over a billing gap
 * that is usually ours. The stamp is what stops that decision from being
 * indistinguishable from nobody noticing.
 */
export async function markTrialEndedUnbilled(subscriptionId: string): Promise<boolean> {
  const firstTime = await db.clinicSubscription.updateMany({
    where: { id: subscriptionId, trialEndedUnbilledAt: null },
    data: { trialEndedUnbilledAt: new Date() },
  });
  return firstTime.count === 1;
}

export type PayPlusTrialConversionOutcome = "converted" | "unbilled" | "failed";

/**
 * Attempts the first real charge for a PayPlus clinic whose trial is over —
 * whether "over" means the calendar date passed (the daily cron's own check,
 * kept exactly as it was) or the clinic just crossed its outcome-based
 * request threshold (an immediate call from request-usage.ts, no calendar
 * check at all). Both callers share this one body so the two triggers can
 * never drift into different billing behavior.
 *
 * periodStart is the caller's decision, not derived here: the cron passes
 * the trial's calendar end (so a clinic never pays for days it already had
 * free), while an immediate conversion passes "now" — an outcome-based trial
 * has no scheduled end to anchor to; this moment IS when it ended.
 */
export async function convertPayPlusTrialToPaid(args: {
  subscriptionId: string;
  plan: SubscriptionPlanType;
  priceMinor: number | null;
  currency: string | null;
  recurringToken: string | null;
  payplusCustomerUid: string | null;
  periodStart: Date;
  dentistEmail: string;
  dentistLocale: string;
  clinicName: string;
  payplusConfigured: boolean;
}): Promise<PayPlusTrialConversionOutcome> {
  if (args.priceMinor === null || args.currency === null) {
    logEvent("error", "subscription.missing_price", {
      subscriptionId: args.subscriptionId,
      priceMinor: args.priceMinor,
      currency: args.currency,
    });
    return "failed";
  }
  const price = { minor: args.priceMinor, currency: args.currency };

  const blocker = billingBlocker({
    payplusConfigured: args.payplusConfigured,
    recurringToken: args.recurringToken,
  });
  if (blocker) {
    const firstTime = await markTrialEndedUnbilled(args.subscriptionId);
    if (firstTime) {
      logEvent("error", "subscription.trial_ended_unbilled", {
        subscriptionId: args.subscriptionId,
        reason: blocker,
      });
      await audit({
        actor: "system",
        action: "subscription.trial_ended_unbilled",
        entity: "ClinicSubscription",
        entityId: args.subscriptionId,
        metadata: { reason: blocker },
      });
      await sendTrialUnbilledAdminEmail({
        clinicName: args.clinicName,
        clinicEmail: args.dentistEmail,
        reason: blocker,
      });
    }
    return "unbilled";
  }

  const clinicT = await getDictionary(asLocale(args.dentistLocale));

  try {
    const result = await chargeByToken({
      // Non-null past the blocker check above; billingBlocker returns
      // "no_card" for exactly this case.
      recurringToken: args.recurringToken!,
      payplusCustomerUid: args.payplusCustomerUid,
      amountMinor: price.minor,
      currency: price.currency,
      description: format(clinicT.clinics.chargeDescription, { clinic: args.clinicName }),
    });

    if (result.ok) {
      await recordRenewalCharge({
        subscriptionId: args.subscriptionId,
        transactionUid: result.transactionUid,
        amountMinor: price.minor,
        currency: price.currency,
        periodStart: args.periodStart,
        periodEnd: nextPeriodEnd(args.periodStart, args.plan),
      });
      await audit({
        actor: "system",
        action: "subscription.trial_converted",
        entity: "ClinicSubscription",
        entityId: args.subscriptionId,
        metadata: {
          transactionUid: result.transactionUid,
          amountMinor: price.minor,
          currency: price.currency,
        },
      });
      return "converted";
    }

    logEvent("error", "subscription.trial_charge_failed", {
      subscriptionId: args.subscriptionId,
      error: result.error,
    });
    // A trialing subscription has no currentPeriodEnd yet — without setting one
    // here, a declined first charge leaves the row invisible to both the grace
    // window (isWithinGrace requires a non-null currentPeriodEnd) and the
    // renewal pass's retry query (which requires the same). Treat the failed
    // attempt as if the period had just ended at periodStart, so the clinic
    // keeps its grace window and the daily cron can retry it — the safety net
    // spec section 7 of the tiered-pricing design promises.
    await db.clinicSubscription.update({
      where: { id: args.subscriptionId },
      data: { currentPeriodEnd: args.periodStart },
    });
    const firstFailure = await markPastDue(args.subscriptionId);
    if (firstFailure) {
      await sendPaymentFailedEmail({
        email: args.dentistEmail,
        clinicName: args.clinicName,
        locale: asLocale(args.dentistLocale),
      });
    }
    return "failed";
  } catch (err) {
    logEvent("error", "subscription.trial_convert_error", {
      subscriptionId: args.subscriptionId,
      error: err instanceof Error ? err.message : String(err),
    });
    return "failed";
  }
}

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await db.clinicSubscription.update({
    where: { id: subscriptionId },
    data: { status: "CANCELED", canceledAt: new Date() },
  });
}

/**
 * The single write path for everything a Stripe webhook learns about a
 * subscription's status. Finds the row by stripeSubscriptionId once it's
 * linked; falls back to setupToken for the very first sync (checkout.session.
 * completed), before the link exists yet. Links stripeSubscriptionId/
 * stripeCustomerId on that first call and leaves them alone afterward.
 */
export async function syncStripeSubscription(args: {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: Stripe.Subscription.Status;
  currentPeriodEnd?: Date | null;
  trialEndsAt?: Date | null;
  setupToken?: string;
}): Promise<{ ok: true; subscriptionId: string } | { ok: false; error: string }> {
  const existing = await db.clinicSubscription.findUnique({
    where: { stripeSubscriptionId: args.stripeSubscriptionId },
    select: { id: true },
  });

  const target =
    existing ??
    (args.setupToken
      ? await db.clinicSubscription.findUnique({
          where: { setupToken: args.setupToken },
          select: { id: true },
        })
      : null);

  if (!target) return { ok: false, error: "subscription not found for Stripe sync" };

  await db.clinicSubscription.update({
    where: { id: target.id },
    data: {
      status: mapStripeSubscriptionStatus(args.status),
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripeCustomerId: args.stripeCustomerId,
      ...(args.currentPeriodEnd !== undefined ? { currentPeriodEnd: args.currentPeriodEnd } : {}),
      ...(args.trialEndsAt !== undefined ? { trialEndsAt: args.trialEndsAt } : {}),
    },
  });
  return { ok: true, subscriptionId: target.id };
}

/** Records a Stripe invoice as a PAID charge. Idempotent on stripeInvoiceId — a webhook Stripe retries must not double-record the same invoice. */
export async function recordStripeCharge(args: {
  subscriptionId: string;
  stripeInvoiceId: string;
  amountMinor: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<void> {
  const existing = await db.subscriptionCharge.findUnique({
    where: { stripeInvoiceId: args.stripeInvoiceId },
    select: { id: true },
  });
  if (existing) return;

  const now = new Date();
  await db.$transaction([
    db.clinicSubscription.update({
      where: { id: args.subscriptionId },
      data: {
        status: "ACTIVE",
        currentPeriodEnd: args.periodEnd,
        lastChargeAt: now,
        paymentFailedNotifiedAt: null,
      },
    }),
    db.subscriptionCharge.create({
      data: {
        subscriptionId: args.subscriptionId,
        amountMinor: args.amountMinor,
        currency: args.currency,
        status: "PAID",
        stripeInvoiceId: args.stripeInvoiceId,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        paidAt: now,
      },
    }),
  ]);
}
