import {
  PLAN_INTERVAL_MONTHS,
  RENEWAL_LEAD_DAYS,
  PAST_DUE_GRACE_DAYS,
  TRIAL_WARNING_DAYS_BEFORE,
  type SubscriptionPlanType,
} from "./constants";
import type { SubscriptionProvider } from "@/generated/prisma/enums";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Who bills a clinic, decided once from its country: PayPlus for Israel,
 * Stripe everywhere else. Shared by registration (which records it) and the
 * join page (which has to show the price in the currency that will be charged).
 */
export function providerForCountry(countryCode: string): SubscriptionProvider {
  return countryCode === "IL" ? "PAYPLUS" : "STRIPE";
}

/** End of the free trial, counted from admin approval (PRD 4.4). */
export function trialEndFrom(approvedAt: Date, trialDays: number): Date {
  return new Date(approvedAt.getTime() + trialDays * DAY_MS);
}

/** A TRIALING subscription is due for its first real charge once the trial ends. */
export function isTrialOver(trialEndsAt: Date | null, now: Date): boolean {
  if (!trialEndsAt) return false;
  return now.getTime() >= trialEndsAt.getTime();
}

/** Whole days left in the trial, floored at 0. */
export function trialDaysRemaining(trialEndsAt: Date | null, now: Date): number {
  if (!trialEndsAt) return 0;
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / DAY_MS));
}

/**
 * Which "trial ending" warning (if any) is due now: the SMALLEST configured mark
 * the remaining days have fallen to or below, and that is smaller than the last
 * one already sent. Returns null when nothing new is due.
 *
 * Smallest, not largest, so the message matches reality — a clinic approved late
 * (or a cron that missed a day) with 2 days left gets "2 days", never a stale
 * "15 days". The `< alreadySentDays` comparison is what stops the daily cron
 * re-sending the same warning on every run.
 */
export function dueTrialWarning(
  trialEndsAt: Date | null,
  alreadySentDays: number | null,
  now: Date,
): number | null {
  if (!trialEndsAt) return null;
  const remaining = trialDaysRemaining(trialEndsAt, now);
  const due = [...TRIAL_WARNING_DAYS_BEFORE]
    .sort((a, b) => a - b)
    .find((mark) => remaining <= mark && (alreadySentDays === null || mark < alreadySentDays));
  return due ?? null;
}

/** Adds whole months, clamping to the last valid day (Jan 31 + 1mo -> Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetMonth = d.getUTCMonth() + months;
  const result = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      targetMonth,
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
    ),
  );
  // If the day rolled over (e.g. Feb 31 -> Mar 3), clamp back to end of target month.
  if (result.getUTCMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setUTCDate(0);
  }
  return result;
}

export function nextPeriodEnd(from: Date, plan: SubscriptionPlanType): Date {
  return addMonths(from, PLAN_INTERVAL_MONTHS[plan]);
}

export function isDueForRenewal(currentPeriodEnd: Date, now: Date): boolean {
  const leadMs = RENEWAL_LEAD_DAYS * DAY_MS;
  return now.getTime() >= currentPeriodEnd.getTime() - leadMs;
}

/**
 * A PAST_DUE clinic keeps its directory listing (and gets retried) for
 * PAST_DUE_GRACE_DAYS after its period end, before it's treated as lapsed.
 */
export function isWithinGrace(currentPeriodEnd: Date | null, now: Date): boolean {
  if (!currentPeriodEnd) return false;
  return now.getTime() <= currentPeriodEnd.getTime() + PAST_DUE_GRACE_DAYS * DAY_MS;
}

/**
 * The earliest currentPeriodEnd a PAST_DUE clinic can have and still be inside
 * its grace window. Prisma can't call isWithinGrace, so directory queries use
 * `currentPeriodEnd >= graceCutoff(now)` to express the same condition.
 */
export function graceCutoff(now: Date): Date {
  return new Date(now.getTime() - PAST_DUE_GRACE_DAYS * DAY_MS);
}

/**
 * Prisma relation filter matching the clinics visible in the directory: TRIALING,
 * ACTIVE, or PAST_DUE whose period ended no earlier than the grace cutoff. The
 * runtime equivalent of isClinicVisible, for use inside db queries.
 *
 * TRIALING MUST be here. The trial only has value because the clinic is live in
 * the directory receiving real leads — omit it and trial clinics silently receive
 * nothing, with no error anywhere to say so.
 */
export function visibleSubscriptionFilter(now: Date = new Date()) {
  return {
    OR: [
      { status: "TRIALING" as const },
      { status: "ACTIVE" as const },
      { status: "PAST_DUE" as const, currentPeriodEnd: { gte: graceCutoff(now) } },
    ],
  };
}

/**
 * Visible in the directory if TRIALING or ACTIVE, or PAST_DUE still inside the
 * grace window. Keep in lockstep with visibleSubscriptionFilter.
 */
export function isClinicVisible(
  sub: { status: string; currentPeriodEnd?: Date | null } | null,
  now: Date = new Date(),
): boolean {
  if (!sub) return false;
  if (sub.status === "TRIALING") return true;
  if (sub.status === "ACTIVE") return true;
  if (sub.status === "PAST_DUE") return isWithinGrace(sub.currentPeriodEnd ?? null, now);
  return false;
}

/**
 * Why a subscription cannot be charged right now, or null when it can be.
 *
 * A trial that ends with a blocker must NOT be charged, and must not silently
 * roll on either — that is the difference between "we chose to let them stay"
 * and "nobody noticed". The two reasons need different actions from different
 * people, which is why this returns which one rather than a boolean:
 *
 * - `no_provider` — PayPlus is not configured. Ours to fix, and it blocks every
 *   clinic at once.
 * - `no_card` — the provider is live but this clinic never completed payment
 *   setup, so there is no stored-card token. One clinic to chase.
 */
export type BillingBlocker = "no_provider" | "no_card";

export function billingBlocker(args: {
  payplusConfigured: boolean;
  recurringToken: string | null;
}): BillingBlocker | null {
  if (!args.payplusConfigured) return "no_provider";
  if (!args.recurringToken) return "no_card";
  return null;
}

/**
 * Has this clinic actually completed payment setup with its provider — as
 * opposed to merely being approved (which sets TRIALING before any payment
 * attempt exists)? Unlike status, this is unambiguous for both providers:
 * PayPlus only ever stores a recurringToken after a real completed charge;
 * Stripe only ever links stripeSubscriptionId after a real completed
 * Checkout session. Use this — never `status` alone — anywhere that needs
 * to tell "approved, nothing attempted yet" apart from "trial genuinely
 * started."
 */
export function hasCompletedPaymentSetup(sub: {
  provider: SubscriptionProvider;
  recurringToken: string | null;
  stripeSubscriptionId: string | null;
}): boolean {
  return sub.provider === "STRIPE" ? sub.stripeSubscriptionId !== null : sub.recurringToken !== null;
}
