import { SUBSCRIPTION_PLANS, RENEWAL_LEAD_DAYS, type SubscriptionPlanType } from "./constants";

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
  const leadMs = RENEWAL_LEAD_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() >= currentPeriodEnd.getTime() - leadMs;
}

export function isClinicVisible(sub: { status: string } | null): boolean {
  return sub?.status === "ACTIVE";
}
