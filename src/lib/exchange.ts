import { isRateStale } from "./money";

/**
 * Finding a usable rate among the ones actually stored.
 *
 * The refresh cron picks the alphabetically first active currency as the base
 * and stores only `base → quote`. There is never a reverse row and never a row
 * between two non-base currencies. A lookup that assumes a direct row exists
 * therefore returns "no rate" almost every time — and the failure is invisible,
 * because the price simply renders without a conversion and looks exactly like
 * a product decision instead of a bug. Hence this module.
 */

export type StoredRate = {
  base: string;
  quote: string;
  rate: number;
  fetchedAt: Date;
};

export type FoundRate = {
  rate: number;
  /** When the rate was fetched — shown to the patient beside the figure. */
  fetchedAt: Date;
};

function direct(rates: StoredRate[], from: string, to: string): FoundRate | null {
  const row = rates.find((r) => r.base === from && r.quote === to);
  return row ? { rate: row.rate, fetchedAt: row.fetchedAt } : null;
}

function inverse(rates: StoredRate[], from: string, to: string): FoundRate | null {
  const row = rates.find((r) => r.base === to && r.quote === from);
  return row && row.rate !== 0 ? { rate: 1 / row.rate, fetchedAt: row.fetchedAt } : null;
}

function older(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/**
 * The rate to multiply a `from` amount by to express it in `to`.
 *
 * Returns null when there is no route, or when any leg of the route is stale.
 * Null means "show no conversion", which is the honest answer once a rate is
 * past the window in RATE_STALE_MS.
 */
export function findRate(
  rates: StoredRate[],
  from: string,
  to: string,
  now: Date = new Date(),
): FoundRate | null {
  // Short-circuits before any row is consulted, so a stale or wrong self-rate
  // can never rewrite an amount. Mirrors the same guard in convert().
  if (from === to) return { rate: 1, fetchedAt: now };

  const usable = rates.filter((r) => !isRateStale(r.fetchedAt, now));

  const oneHop = direct(usable, from, to) ?? inverse(usable, from, to);
  if (oneHop) return oneHop;

  // Neither side is the base: go from → base → to. Every stored row shares the
  // same base, so that base is the only possible pivot.
  const base = usable[0]?.base;
  if (!base) return null;

  const toBase = inverse(usable, from, base);
  const fromBase = direct(usable, base, to);
  if (!toBase || !fromBase) return null;

  return {
    rate: toBase.rate * fromBase.rate,
    // Only as current as its oldest leg, and this date is shown to the patient.
    fetchedAt: older(toBase.fetchedAt, fromBase.fetchedAt),
  };
}
