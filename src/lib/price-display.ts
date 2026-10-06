import countryToCurrency from "country-to-currency";

/**
 * What the comparison table puts in a quote's price cell.
 *
 * Three quotes in pounds, lira and forint can't be compared by eye: the biggest
 * number may be the cheapest offer. So the headline is the price in the
 * patient's own currency, marked approximate, and the clinic's own figure, the
 * one actually charged, sits beneath it. With no usable rate the clinic's
 * figure is the headline, as it always was.
 */
export type Money = { minor: number; currency: string };

export type ComparisonPrice = {
  headline: Money;
  /** True when the headline is a conversion, not what the clinic charges. */
  approximate: boolean;
  /** The clinic's own price, shown under a converted headline. */
  clinicPrice: Money | null;
  rateDate: Date | null;
};

export function comparisonPrice(
  quote: { amountMinor: number; currency: string },
  conversion: { minor: number; fetchedAt: Date } | null,
  patientCurrency: string,
): ComparisonPrice {
  const own = { minor: quote.amountMinor, currency: quote.currency };
  if (!conversion || quote.currency === patientCurrency) {
    return { headline: own, approximate: false, clinicPrice: null, rateDate: null };
  }
  return {
    headline: { minor: conversion.minor, currency: patientCurrency },
    approximate: true,
    clinicPrice: own,
    rateDate: conversion.fetchedAt,
  };
}

/**
 * The currency a patient compares in when they haven't set a country. US
 * dollars: the site serves patients worldwide and has no home market, and the
 * dollar is the currency most people abroad can read a price in.
 */
export const FALLBACK_PATIENT_CURRENCY = "USD";

/**
 * The currency of the country the patient lives in. Any country in the world,
 * not only those with clinics, so it comes from an ISO country→currency map
 * rather than the Country table.
 */
export function patientCurrencyFor(countryCode: string | null | undefined): string {
  if (!countryCode) return FALLBACK_PATIENT_CURRENCY;
  return (countryToCurrency as Record<string, string>)[countryCode] ?? FALLBACK_PATIENT_CURRENCY;
}

/**
 * Which rates the daily refresh asks for: every currency in use, plus the
 * fallback, so a patient without a country can always compare. The base is
 * always EUR (the source is the ECB): a base that followed the alphabet would
 * change the day a currency sorting before it appeared.
 */
export const RATE_BASE = "EUR";

export function ratesToFetch(currencies: string[]): { base: string; quotes: string[] } {
  const quotes = [...new Set([...currencies, FALLBACK_PATIENT_CURRENCY])]
    .filter((c) => c !== RATE_BASE)
    .sort();
  return { base: RATE_BASE, quotes };
}

type Convert = (minor: number, from: string) => { minor: number; fetchedAt: Date } | null;

/**
 * The currency the table compares in. The patient's own, if every quote can be
 * converted into it; otherwise US dollars, if that works. The rate source
 * covers about thirty currencies, and a patient whose currency isn't one of
 * them would otherwise get no comparison at all.
 */
export function chooseComparisonCurrency(
  preferred: string,
  quotes: { amountMinor: number; currency: string }[],
  toPreferred: Convert,
  toFallback: Convert,
): string {
  const allConvert = (to: string, convert: Convert) =>
    quotes.every((q) => q.currency === to || convert(q.amountMinor, q.currency) !== null);
  if (allConvert(preferred, toPreferred)) return preferred;
  if (allConvert(FALLBACK_PATIENT_CURRENCY, toFallback)) return FALLBACK_PATIENT_CURRENCY;
  return preferred;
}
