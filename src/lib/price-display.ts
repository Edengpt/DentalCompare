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

export function patientCurrencyFor(countryCurrency: string | null | undefined): string {
  return countryCurrency ?? FALLBACK_PATIENT_CURRENCY;
}

/**
 * Which rates the daily refresh asks for: every active clinic currency, plus
 * the fallback, so a patient without a country can always compare. The first
 * currency alphabetically is the base, as before. Null when there is nothing
 * to convert between.
 */
export function ratesToFetch(
  activeCurrencies: string[],
): { base: string; quotes: string[] } | null {
  const currencies = [...new Set([...activeCurrencies, FALLBACK_PATIENT_CURRENCY])].sort();
  if (currencies.length < 2) return null;
  const [base, ...quotes] = currencies;
  return { base, quotes };
}
