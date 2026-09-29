import { toMajor, toMinor } from "./money";
import { addMonths } from "./subscription";

/**
 * The founding offer: the first FOUNDING_SLOTS clinics on a paid plan pay a
 * third less for their first FOUNDING_MONTHS of billing, then move to the list
 * price automatically, with a notice FOUNDING_NOTICE_DAYS beforehand.
 *
 * It exists because the first clinics join an empty marketplace. A price that
 * rewards going first, with a visible countdown of places, gives them a reason
 * not to wait for others to go before them.
 *
 * Pure helpers only; slot counting (which needs the database) lives in
 * src/server/founding.ts.
 */
export const FOUNDING_SLOTS = 50;
export const FOUNDING_MONTHS = 12;
export const FOUNDING_NOTICE_DAYS = 30;

/** A third off, rounded to a whole unit of the currency: ₪299 → ₪199, $79 → $53. */
export function foundingPriceMinor(regularMinor: number, currency: string): number {
  const major = toMajor(regularMinor, currency);
  return toMinor(Math.round((major * 2) / 3), currency);
}

/** Twelve months of discounted billing, counted from the first real charge. */
export function foundingEndFrom(firstChargeAt: Date): Date {
  return addMonths(firstChargeAt, FOUNDING_MONTHS);
}

/** True once the price-rise notice should go out and hasn't yet. */
export function isFoundingNoticeDue(
  sub: { isFounding: boolean; foundingEndsAt: Date | null; foundingNoticeSentAt: Date | null },
  now: Date,
): boolean {
  if (!sub.isFounding || !sub.foundingEndsAt || sub.foundingNoticeSentAt) return false;
  const noticeFrom = sub.foundingEndsAt.getTime() - FOUNDING_NOTICE_DAYS * 24 * 60 * 60 * 1000;
  return now.getTime() >= noticeFrom && now.getTime() < sub.foundingEndsAt.getTime();
}

/**
 * The price a founding PayPlus subscription should be charged at `now`: the
 * discounted snapshot until foundingEndsAt, the regular price from then on.
 * Stripe needs none of this — its coupon simply runs out.
 */
export function effectivePriceMinor(
  sub: {
    priceMinor: number;
    isFounding: boolean;
    regularPriceMinor: number | null;
    foundingEndsAt: Date | null;
  },
  now: Date,
): number {
  if (
    sub.isFounding &&
    sub.regularPriceMinor !== null &&
    sub.foundingEndsAt &&
    now.getTime() >= sub.foundingEndsAt.getTime()
  ) {
    return sub.regularPriceMinor;
  }
  return sub.priceMinor;
}

/**
 * How long the Stripe coupon must run. Stripe counts a repeating coupon from
 * the moment the subscription is created, trial included, so the trial months
 * are added on top. A yearly plan needs only its first paid invoice covered.
 */
export function stripeCouponMonths(trialDays: number, plan: "MONTHLY" | "YEARLY"): number {
  const trialMonths = Math.ceil(trialDays / 30);
  return trialMonths + (plan === "MONTHLY" ? FOUNDING_MONTHS : 1);
}
