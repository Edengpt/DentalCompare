import "server-only";
import { db } from "@/lib/db";
import { currentYearMonth } from "@/lib/date";
import { logEvent } from "@/lib/log";
import { isPayPlusConfigured } from "@/lib/payplus";
import { endStripeTrialNow } from "@/lib/stripe";
import { convertPayPlusTrialToPaid } from "@/server/subscriptions";
import type { SubscriptionPlanType } from "@/lib/constants";

type TrialSubscriptionAfterIncrement = {
  id: string;
  status: string;
  provider: "PAYPLUS" | "STRIPE";
  plan: string;
  priceMinor: number | null;
  currency: string | null;
  recurringToken: string | null;
  payplusCustomerUid: string | null;
  stripeSubscriptionId: string | null;
  trialRequestCap: number;
  verifiedRequestCount: number;
  dentist: { clinicName: string; email: string; locale: string };
};

/**
 * Records that a request was actually delivered to a clinic — the trigger
 * for both the outcome-based trial (lifetime count on ClinicSubscription)
 * and the monthly request cap (MonthlyRequestUsage, unread by anything until
 * the request-cap-enforcement plan). Called once per (request, clinic) pair,
 * right after fulfillment.ts confirms the email to that clinic actually sent.
 *
 * If this push crosses the clinic's frozen trialRequestCap while it is still
 * TRIALING, the trial converts immediately. A daily cron remains the safety
 * net for PayPlus (a clinic that never crosses the threshold still converts
 * on its calendar trialEndsAt, unchanged by this plan); Stripe's own
 * trial_period_days, set at Checkout, is that same safety net for Stripe
 * clinics.
 */
export async function recordVerifiedRequest(dentistId: string): Promise<void> {
  const yearMonth = currentYearMonth();

  const [sub] = await db.$transaction([
    db.clinicSubscription.update({
      where: { dentistId },
      data: { verifiedRequestCount: { increment: 1 } },
      select: {
        id: true,
        status: true,
        provider: true,
        plan: true,
        priceMinor: true,
        currency: true,
        recurringToken: true,
        payplusCustomerUid: true,
        stripeSubscriptionId: true,
        trialRequestCap: true,
        verifiedRequestCount: true,
        dentist: { select: { clinicName: true, email: true, locale: true } },
      },
    }),
    db.monthlyRequestUsage.upsert({
      where: { dentistId_yearMonth: { dentistId, yearMonth } },
      create: { dentistId, yearMonth, count: 1 },
      update: { count: { increment: 1 } },
    }),
  ]);

  // Strict equality, not >=: verifiedRequestCount's increments are serialized
  // by Postgres's row lock and only ever move by 1, so exactly one concurrent
  // caller ever observes the count landing exactly on trialRequestCap — this
  // is what makes the immediate-conversion trigger safe to call from multiple
  // concurrent fulfillments of the same clinic without double-charging it. A
  // subscription whose count somehow starts above its cap will not convert
  // immediately (falls back to the calendar safety net instead) — an
  // acceptable, safe failure direction for an edge case that should not occur
  // in practice.
  if (sub.status !== "TRIALING" || sub.verifiedRequestCount !== sub.trialRequestCap) return;

  await attemptImmediateConversion(sub as TrialSubscriptionAfterIncrement);
}

async function attemptImmediateConversion(sub: TrialSubscriptionAfterIncrement): Promise<void> {
  if (sub.provider === "PAYPLUS") {
    await convertPayPlusTrialToPaid({
      subscriptionId: sub.id,
      plan: sub.plan as SubscriptionPlanType,
      priceMinor: sub.priceMinor,
      currency: sub.currency,
      recurringToken: sub.recurringToken,
      payplusCustomerUid: sub.payplusCustomerUid,
      periodStart: new Date(),
      dentistEmail: sub.dentist.email,
      dentistLocale: sub.dentist.locale,
      clinicName: sub.dentist.clinicName,
      payplusConfigured: isPayPlusConfigured(),
    });
    return;
  }

  // STRIPE. Nothing to end early if the clinic never completed Checkout —
  // the same known gap already documented for the PayPlus side (a clinic
  // approved but never onboarded has no subscription to act on yet). Stripe's
  // own trial_period_days is what eventually surfaces this one.
  if (!sub.stripeSubscriptionId) {
    logEvent("info", "subscription.trial_threshold_no_stripe_subscription", {
      subscriptionId: sub.id,
    });
    return;
  }

  try {
    await endStripeTrialNow(sub.stripeSubscriptionId);
  } catch (err) {
    logEvent("error", "subscription.stripe_trial_end_failed", {
      subscriptionId: sub.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
