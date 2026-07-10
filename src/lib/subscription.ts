import {
  SUBSCRIPTION_PLANS,
  RENEWAL_LEAD_DAYS,
  PAST_DUE_GRACE_DAYS,
  type SubscriptionPlanType,
} from "./constants";

const DAY_MS = 24 * 60 * 60 * 1000;

export function planPriceILS(plan: SubscriptionPlanType): number {
  return SUBSCRIPTION_PLANS[plan].priceILS;
}

/** Adds whole months, clamping to the last valid day (Jan 31 + 1mo -> Feb 28/29). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetMonth = d.getUTCMonth() + months;
  const result = new Date(
    Date.UTC(d.getUTCFullYear(), targetMonth, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()),
  );
  // If the day rolled over (e.g. Feb 31 -> Mar 3), clamp back to end of target month.
  if (result.getUTCMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setUTCDate(0);
  }
  return result;
}

export function nextPeriodEnd(from: Date, plan: SubscriptionPlanType): Date {
  return addMonths(from, SUBSCRIPTION_PLANS[plan].intervalMonths);
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
 * Prisma relation filter matching the clinics visible in the directory: ACTIVE,
 * or PAST_DUE whose period ended no earlier than the grace cutoff. The runtime
 * equivalent of isClinicVisible, for use inside db queries.
 */
export function visibleSubscriptionFilter(now: Date = new Date()) {
  return {
    OR: [
      { status: "ACTIVE" as const },
      { status: "PAST_DUE" as const, currentPeriodEnd: { gte: graceCutoff(now) } },
    ],
  };
}

/** Visible in the directory if ACTIVE, or PAST_DUE still inside the grace window. */
export function isClinicVisible(
  sub: { status: string; currentPeriodEnd?: Date | null } | null,
  now: Date = new Date(),
): boolean {
  if (!sub) return false;
  if (sub.status === "ACTIVE") return true;
  if (sub.status === "PAST_DUE") return isWithinGrace(sub.currentPeriodEnd ?? null, now);
  return false;
}
