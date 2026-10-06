import { toMinor } from "./money";
import { QUOTE_LIMITS } from "./quote-catalog";

export type PricingError = "NO_LINES" | "BAD_LINE" | "BAD_DISCOUNT" | "TOO_HIGH";

export type QuoteTotals = {
  ok: true;
  lines: { unitPriceMinor: number; lineTotalMinor: number }[];
  subtotalMinor: number;
  /** 0 when there is no discount. */
  discountMinor: number;
  finalMinor: number;
};

/**
 * The price of a quote, from its lines and an optional package discount.
 *
 * One function for both sides: the form calls it for the live total and
 * submitQuote calls it for the stored one, so what the clinic saw is what the
 * patient gets — and the server never trusts a total the browser sent.
 *
 * Each unit price is converted to minor units once, then everything is integer
 * arithmetic (see lib/money for why). A unit price of 0 is allowed — "the
 * x-ray is on us" is a real line — but the quote as a whole can't be free, and
 * a discount can only lower the price, never wipe it out: a zero final would
 * win every "cheapest" badge.
 */
export function computeQuoteTotals(
  lines: { quantity: number; unitPriceMajor: number }[],
  discountMajor: number | null,
  currency: string,
): QuoteTotals | { ok: false; error: PricingError } {
  if (lines.length === 0) return { ok: false, error: "NO_LINES" };
  if (lines.length > QUOTE_LIMITS.maxItems) return { ok: false, error: "BAD_LINE" };
  const ceilingMinor = toMinor(QUOTE_LIMITS.maxPriceMajor, currency);

  const priced: QuoteTotals["lines"] = [];
  let subtotalMinor = 0;
  for (const line of lines) {
    const q = line.quantity;
    const unit = line.unitPriceMajor;
    if (!Number.isInteger(q) || q < 1 || q > QUOTE_LIMITS.maxQuantity) {
      return { ok: false, error: "BAD_LINE" };
    }
    if (!Number.isFinite(unit) || unit < 0) return { ok: false, error: "BAD_LINE" };
    const unitPriceMinor = toMinor(unit, currency);
    if (unitPriceMinor > ceilingMinor) return { ok: false, error: "TOO_HIGH" };
    const lineTotalMinor = unitPriceMinor * q;
    subtotalMinor += lineTotalMinor;
    priced.push({ unitPriceMinor, lineTotalMinor });
  }
  if (subtotalMinor <= 0) return { ok: false, error: "NO_LINES" };
  if (subtotalMinor > ceilingMinor) return { ok: false, error: "TOO_HIGH" };

  let discountMinor = 0;
  if (discountMajor !== null) {
    if (!Number.isFinite(discountMajor) || discountMajor < 0) {
      return { ok: false, error: "BAD_DISCOUNT" };
    }
    discountMinor = toMinor(discountMajor, currency);
    if (discountMinor >= subtotalMinor) return { ok: false, error: "BAD_DISCOUNT" };
  }

  return {
    ok: true,
    lines: priced,
    subtotalMinor,
    discountMinor,
    finalMinor: subtotalMinor - discountMinor,
  };
}
