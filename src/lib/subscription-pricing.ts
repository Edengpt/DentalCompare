import "server-only";
import { db } from "@/lib/db";
import { toMinor } from "@/lib/money";
import type { SubscriptionProvider, SubscriptionTier } from "@/generated/prisma/enums";

/**
 * Reads one (provider, tier) row's current price/cap/trial settings. Throws if
 * the row is missing — every provider×tier pair has a seeded row (Task 1's
 * migration), so a miss here means the seed never ran, which is a deploy
 * defect worth a loud crash rather than a silently-free subscription.
 */
export async function getSubscriptionPricing(provider: SubscriptionProvider, tier: SubscriptionTier) {
  // Lemon Squeezy replaces Stripe for the same international clinics, in the
  // same USD prices — one table row per market, not per payment company.
  const row = provider === "LEMONSQUEEZY" ? "STRIPE" : provider;
  return db.subscriptionPricing.findUniqueOrThrow({ where: { provider_tier: { provider: row, tier } } });
}

export type RawPricingInput = {
  monthlyPriceMajor: string;
  yearlyPriceMajor: string;
  trialDays: string;
  /** Empty string parses to unlimited (null). */
  monthlyRequestCap: string;
  trialRequestCap: string;
};

export type PricingField = keyof RawPricingInput;

export type ParsedPricing = {
  monthlyPriceMinor: number;
  yearlyPriceMinor: number;
  trialDays: number;
  monthlyRequestCap: number | null;
  trialRequestCap: number;
};

export type ParseResult = { ok: true; value: ParsedPricing } | { ok: false; field: PricingField };

/**
 * Validation for admin-entered pricing. Free of database and server-only
 * imports (aside from the currency-aware `toMinor` conversion), mirroring
 * `src/lib/country-input.ts` so it can be unit-tested without a database.
 */
// A generous ceiling that would never reject a real price, but catches a
// fat-fingered extra zero (e.g. "2990" instead of "299") before it gets
// audited and charged to every clinic that registers after it.
const MAX_PRICE_MAJOR = 100_000;
// Same fat-finger guard for request caps and the trial threshold — generous
// enough that no real value would ever hit it.
const MAX_REQUEST_CAP = 10_000;
const MAX_TRIAL_REQUEST_CAP = 1_000;

export function parsePricingInput(
  raw: RawPricingInput,
  currency: string,
  tier: SubscriptionTier,
): ParseResult {
  const monthlyMajor = Number(raw.monthlyPriceMajor);
  const yearlyMajor = Number(raw.yearlyPriceMajor);

  if (tier === "FREE") {
    // Locked to 0 server-side, not just hidden/readonly in the UI — a client
    // that bypasses the form (or a future caller) cannot price FREE above 0.
    if (!Number.isFinite(monthlyMajor) || monthlyMajor !== 0) {
      return { ok: false, field: "monthlyPriceMajor" };
    }
    if (!Number.isFinite(yearlyMajor) || yearlyMajor !== 0) {
      return { ok: false, field: "yearlyPriceMajor" };
    }
  } else {
    if (!Number.isFinite(monthlyMajor) || monthlyMajor <= 0 || monthlyMajor > MAX_PRICE_MAJOR) {
      return { ok: false, field: "monthlyPriceMajor" };
    }
    if (!Number.isFinite(yearlyMajor) || yearlyMajor <= 0 || yearlyMajor > MAX_PRICE_MAJOR) {
      return { ok: false, field: "yearlyPriceMajor" };
    }
  }

  const trialDays = Math.floor(Number(raw.trialDays));
  if (!Number.isFinite(trialDays) || trialDays < 1 || trialDays > 365) {
    return { ok: false, field: "trialDays" };
  }

  let monthlyRequestCap: number | null = null;
  const capRaw = raw.monthlyRequestCap.trim();
  if (capRaw !== "") {
    const cap = Math.floor(Number(capRaw));
    if (!Number.isFinite(cap) || cap < 1 || cap > MAX_REQUEST_CAP) {
      return { ok: false, field: "monthlyRequestCap" };
    }
    monthlyRequestCap = cap;
  }

  const trialRequestCap = Math.floor(Number(raw.trialRequestCap));
  if (!Number.isFinite(trialRequestCap) || trialRequestCap < 1 || trialRequestCap > MAX_TRIAL_REQUEST_CAP) {
    return { ok: false, field: "trialRequestCap" };
  }

  return {
    ok: true,
    value: {
      monthlyPriceMinor: toMinor(monthlyMajor, currency),
      yearlyPriceMinor: toMinor(yearlyMajor, currency),
      trialDays,
      monthlyRequestCap,
      trialRequestCap,
    },
  };
}
