import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  isDueForRenewal,
  isWithinGrace,
  nextPeriodEnd,
  isTrialOver,
  dueTrialWarning,
  trialDaysRemaining,
} from "@/lib/subscription";
import { chargeByToken, isPayPlusConfigured } from "@/lib/payplus";
import {
  recordRenewalCharge,
  markPastDue,
  cancelSubscription,
  convertPayPlusTrialToPaid,
} from "@/server/subscriptions";
import {
  sendPaymentFailedEmail,
  sendTrialEndingEmail,
} from "@/server/subscription-notifications";
import { audit } from "@/lib/audit";
import { logEvent } from "@/lib/log";
import { asLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { format } from "@/i18n/format";
import type { SubscriptionPlanType } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


/**
 * Reads the (minor units, currency) pair off a subscription, refusing to guess.
 *
 * Defaulting a missing amount to 0 would charge the clinic nothing and mark the
 * period paid — a silent revenue loss that looks like success in every log. The
 * M2 backfill set these on every row and every write path sets them, so null
 * here means something is genuinely wrong and the subscription must be skipped
 * loudly rather than processed.
 */
function subscriptionPrice(sub: {
  id: string;
  priceMinor: number | null;
  currency: string | null;
}): { minor: number; currency: string } | null {
  if (sub.priceMinor === null || sub.currency === null) {
    logEvent("error", "subscription.missing_price", {
      subscriptionId: sub.id,
      priceMinor: sub.priceMinor,
      currency: sub.currency,
    });
    return null;
  }
  return { minor: sub.priceMinor, currency: sub.currency };
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // The PayPlus gate guards the CHARGE, not the job. It used to return here, and
  // production has never had PayPlus configured — so a trialing clinic got no
  // warning emails, no charge and no expiry: free forever, with nothing anywhere
  // saying so. The trial clock is ours and runs regardless of who takes the money.
  const payplusConfigured = isPayPlusConfigured();

  const now = new Date();

  // ── Pass 1: free trials (PRD 4.4) ──────────────────────────────────────────
  // Handled separately from renewals because a trialing subscription has no
  // currentPeriodEnd yet — its clock is trialEndsAt.
  const trials = await db.clinicSubscription.findMany({
    where: { status: "TRIALING", trialEndsAt: { not: null }, provider: "PAYPLUS" },
    select: {
      id: true,
      plan: true,
      priceMinor: true,
      currency: true,
      recurringToken: true,
      setupToken: true,
      payplusCustomerUid: true,
      trialEndsAt: true,
      trialWarningSentDays: true,
      dentist: { select: { clinicName: true, email: true, locale: true } },
    },
  });

  let trialsConverted = 0;
  let trialsWarned = 0;
  let trialsFailed = 0;
  let trialsUnbilled = 0;

  for (const sub of trials) {
    if (!sub.trialEndsAt) continue;

    const price = subscriptionPrice(sub);
    if (!price) {
      trialsFailed += 1;
      continue;
    }

    // Still inside the trial → only consider a heads-up email.
    if (!isTrialOver(sub.trialEndsAt, now)) {
      const mark = dueTrialWarning(sub.trialEndsAt, sub.trialWarningSentDays, now);
      if (mark !== null) {
        const sent = await sendTrialEndingEmail({
          email: sub.dentist.email,
          clinicName: sub.dentist.clinicName,
          daysRemaining: trialDaysRemaining(sub.trialEndsAt, now),
          priceMinor: price.minor,
          currency: price.currency,
          plan: sub.plan as SubscriptionPlanType,
          locale: asLocale(sub.dentist.locale),
          // A stored card means nothing left to set up; without one the warning
          // has to ask for the card instead of announcing a charge.
          setupToken: sub.recurringToken ? null : sub.setupToken,
        });
        // Only record the mark once the mail actually went out, so a transient
        // Resend failure doesn't silently swallow the warning.
        if (sent) {
          await db.clinicSubscription.update({
            where: { id: sub.id },
            data: { trialWarningSentDays: mark },
          });
          trialsWarned += 1;
        }
      }
      continue;
    }

    // Trial is over. Delegate to the shared conversion path so the cron and
    // the immediate outcome-based trigger (src/server/request-usage.ts) can
    // never diverge in billing behavior.
    const outcome = await convertPayPlusTrialToPaid({
      subscriptionId: sub.id,
      plan: sub.plan as SubscriptionPlanType,
      priceMinor: sub.priceMinor,
      currency: sub.currency,
      recurringToken: sub.recurringToken,
      payplusCustomerUid: sub.payplusCustomerUid,
      periodStart: sub.trialEndsAt,
      dentistEmail: sub.dentist.email,
      dentistLocale: sub.dentist.locale,
      clinicName: sub.dentist.clinicName,
      payplusConfigured,
    });
    if (outcome === "converted") trialsConverted += 1;
    else if (outcome === "unbilled") trialsUnbilled += 1;
    else trialsFailed += 1;
  }

  // ── Pass 2: renewals ───────────────────────────────────────────────────────
  // Both ACTIVE (due for renewal) and PAST_DUE (being retried within grace).
  //
  // Unlike the trial pass this one is skipped wholesale without a provider, and
  // that includes the lapse-to-CANCELED branch: cancelling a paying clinic
  // because OUR provider is down would punish it for our outage. The skip is
  // reported in the response rather than hidden.
  const candidates = payplusConfigured
    ? await db.clinicSubscription.findMany({
        where: {
          status: { in: ["ACTIVE", "PAST_DUE"] },
          recurringToken: { not: null },
          currentPeriodEnd: { not: null },
          provider: "PAYPLUS",
        },
        select: {
          id: true,
          plan: true,
          priceMinor: true,
          currency: true,
          status: true,
          recurringToken: true,
          payplusCustomerUid: true,
          currentPeriodEnd: true,
          dentist: { select: { clinicName: true, email: true, locale: true } },
        },
      })
    : [];

  let renewed = 0;
  let failed = 0;
  let canceled = 0;

  for (const sub of candidates) {
    if (!sub.currentPeriodEnd || !sub.recurringToken) continue;

    // A PAST_DUE clinic past its grace window has lapsed → cancel and drop it.
    if (sub.status === "PAST_DUE" && !isWithinGrace(sub.currentPeriodEnd, now)) {
      await cancelSubscription(sub.id);
      await audit({
        actor: "system",
        action: "subscription.canceled",
        entity: "ClinicSubscription",
        entityId: sub.id,
        metadata: { reason: "grace_expired" },
      });
      canceled += 1;
      continue;
    }

    // ACTIVE subs are charged only inside the lead window; PAST_DUE subs are
    // already past their end, so they get retried on every run within grace.
    if (sub.status === "ACTIVE" && !isDueForRenewal(sub.currentPeriodEnd, now)) continue;

    // Checked after the cancel branch: a lapsed subscription should still be
    // cancelled even if its price is somehow unreadable.
    const price = subscriptionPrice(sub);
    if (!price) {
      failed += 1;
      continue;
    }
    const clinicT = await getDictionary(asLocale(sub.dentist.locale));

    try {
      const result = await chargeByToken({
        recurringToken: sub.recurringToken,
        payplusCustomerUid: sub.payplusCustomerUid,
        amountMinor: price.minor,
        currency: price.currency,
        description: format(clinicT.clinics.renewalDescription, { clinic: sub.dentist.clinicName }),
      });

      if (result.ok) {
        const periodStart = sub.currentPeriodEnd;
        const periodEnd = nextPeriodEnd(periodStart, sub.plan as SubscriptionPlanType);
        await recordRenewalCharge({
          subscriptionId: sub.id,
          transactionUid: result.transactionUid,
          amountMinor: price.minor,
          currency: price.currency,
          periodStart,
          periodEnd,
        });
        await audit({
          actor: "system",
          action: "subscription.renewed",
          entity: "ClinicSubscription",
          entityId: sub.id,
          metadata: {
            transactionUid: result.transactionUid,
            amountMinor: price.minor,
            currency: price.currency,
          },
        });
        renewed += 1;
      } else {
        logEvent("error", "subscription.charge_failed", {
          subscriptionId: sub.id,
          error: result.error,
        });
        // Move to PAST_DUE and notify the clinic exactly once (not every retry).
        const firstFailure = await markPastDue(sub.id);
        if (firstFailure) {
          await sendPaymentFailedEmail({
            email: sub.dentist.email,
            clinicName: sub.dentist.clinicName,
            locale: asLocale(sub.dentist.locale),
          });
        }
        failed += 1;
      }
    } catch (err) {
      logEvent("error", "subscription.renew_error", {
        subscriptionId: sub.id,
        error: err instanceof Error ? err.message : String(err),
      });
      failed += 1;
    }
  }

  return NextResponse.json({
    // Reported so a run that did nothing can be told apart from a run that
    // could do nothing.
    payplusConfigured,
    checked: candidates.length,
    renewed,
    failed,
    canceled,
    trials: {
      checked: trials.length,
      converted: trialsConverted,
      warned: trialsWarned,
      failed: trialsFailed,
      unbilled: trialsUnbilled,
    },
  });
}
