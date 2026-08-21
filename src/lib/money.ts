/**
 * Money is always an integer count of minor units plus an ISO 4217 code.
 *
 * The pair is the unit — a bare number is meaningless once more than one
 * currency exists, which is exactly what internationalisation introduces. The
 * old patient-fee model already stored `amountAgorot`; this generalises that
 * instinct rather than inventing it.
 *
 * Integers, because floats drift. A fractional agora that rounds the wrong way
 * is a real mischarge, and the error compounds across recurring billing.
 *
 * Deliberately free of database and server-only imports so it can be used from
 * client components and tested without a shim.
 */

/** Canonical ISO 4217: exactly three upper-case letters. */
export function isSupportedCurrency(code: string): boolean {
  return /^[A-Z]{3}$/.test(code);
}

/**
 * How many minor units make one major unit, as a digit count.
 *
 * Not every currency is 100. JPY has no minor unit at all and KWD has 1000, so
 * a hardcoded 100 would overstate a yen amount by 100x. Read from Intl rather
 * than assumed, and falls back to 2 for an unrecognised code instead of
 * throwing — a bad currency string should not take down a page that is only
 * trying to render a price.
 */
export function minorUnitDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * Major units to minor.
 *
 * Rounds rather than truncates — truncation biases every amount downward, and
 * across a list of quotes that systematically understates the more expensive
 * ones.
 *
 * The scaling goes through exponent notation rather than multiplication, and
 * that is not a stylistic choice. `1.005 * 100` is `100.49999999999999` in
 * IEEE-754, so `Math.round` returns 100 and silently loses an agora; the same
 * class of error is why this module stores integers in the first place.
 * `Number("1.005e2")` is exactly `100.5`, because the decimal string is parsed
 * rather than a binary product being rounded.
 */
export function toMinor(major: number, currency: string): number {
  const digits = minorUnitDigits(currency);
  if (!Number.isFinite(major)) return NaN;

  // A number already in exponential form ("1e-7") can't have another exponent
  // appended, so fall back to multiplication for those. They are far outside
  // the range of any real price, where the precision issue above bites.
  const asString = String(major);
  if (asString.includes("e") || asString.includes("E")) {
    return Math.round(major * 10 ** digits);
  }

  return Math.round(Number(`${asString}e${digits}`));
}

/**
 * Minor units back to major.
 *
 * Use only at a boundary that demands major units — PayPlus takes shekels, not
 * agorot — or for display. Never as an intermediate step in arithmetic, which
 * would reintroduce the float drift the integer representation exists to avoid.
 */
export function toMajor(minor: number, currency: string): number {
  return minor / 10 ** minorUnitDigits(currency);
}

/**
 * Renders an amount in the reader's locale with the amount's own currency.
 *
 * The symbol comes from the data, never from a literal. A hardcoded ₪ next to a
 * euro amount is not a formatting slip — it misstates a price to a patient
 * deciding whether to fly to another country for treatment.
 */
export function formatMoney(minor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    toMajor(minor, currency),
  );
}

/**
 * How old a rate may be before it is no longer shown.
 *
 * 48 hours rather than 24: the refresh runs daily, and a single missed run
 * shouldn't blank out every converted price on the site. Two missed runs
 * should.
 */
export const RATE_STALE_MS = 48 * 60 * 60 * 1000;

export function isRateStale(fetchedAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - fetchedAt.getTime() > RATE_STALE_MS;
}

/**
 * Converts an amount between currencies, rescaling when their minor-unit
 * digits differ.
 *
 * For DISPLAY only. A quote is always stored in the currency the clinic named —
 * converting at save time would commit the platform to a price it does not
 * control and cannot honour when the rate moves.
 *
 * Same-currency conversion returns the amount untouched regardless of the rate
 * passed, so a stale or wrong self-rate can never rewrite an amount.
 */
export function convert(minor: number, from: string, to: string, rate: number): number {
  if (from === to) return minor;
  return Math.round(toMajor(minor, from) * rate * 10 ** minorUnitDigits(to));
}

