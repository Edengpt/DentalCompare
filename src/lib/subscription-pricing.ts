import "server-only";
import { db } from "@/lib/db";
import { toMinor } from "@/lib/money";
import type { SubscriptionProvider } from "@/generated/prisma/enums";

/**
 * Reads one provider's current price/trial settings. Throws if the row is
 * missing — every provider has a seeded row (Task 1's migration), so a miss
 * here means the seed never ran, which is a deploy defect worth a loud crash
 * rather than a silently-free subscription.
 */
export async function getSubscriptionPricing(provider: SubscriptionProvider) {
  return db.subscriptionPricing.findUniqueOrThrow({ where: { provider } });
}

export type RawPricingInput = {
  monthlyPriceMajor: string;
  yearlyPriceMajor: string;
  trialDays: string;
};

export type PricingField = keyof RawPricingInput;

export type ParsedPricing = {
  monthlyPriceMinor: number;
  yearlyPriceMinor: number;
  trialDays: number;
};

export type ParseResult = { ok: true; value: ParsedPricing } | { ok: false; field: PricingField };

/**
 * Validation for admin-entered pricing. Free of database and server-only
 * imports (aside from the currency-aware `toMinor` conversion), mirroring
 * `src/lib/country-input.ts` so it can be unit-tested without a database.
 */
export function parsePricingInput(raw: RawPricingInput, currency: string): ParseResult {
  const monthlyMajor = Number(raw.monthlyPriceMajor);
  if (!Number.isFinite(monthlyMajor) || monthlyMajor <= 0) {
    return { ok: false, field: "monthlyPriceMajor" };
  }

  const yearlyMajor = Number(raw.yearlyPriceMajor);
  if (!Number.isFinite(yearlyMajor) || yearlyMajor <= 0) {
    return { ok: false, field: "yearlyPriceMajor" };
  }

  const trialDays = Math.floor(Number(raw.trialDays));
  if (!Number.isFinite(trialDays) || trialDays < 1 || trialDays > 365) {
    return { ok: false, field: "trialDays" };
  }

  return {
    ok: true,
    value: {
      monthlyPriceMinor: toMinor(monthlyMajor, currency),
      yearlyPriceMinor: toMinor(yearlyMajor, currency),
      trialDays,
    },
  };
}
