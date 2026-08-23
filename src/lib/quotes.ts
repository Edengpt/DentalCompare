export type QuoteRow = {
  dentistId: string;
  dentistName: string;
  clinicName: string;
  city: string;
  amountMinor: number | null;
  // Always travels with the amount. A minor-unit integer alone can't be
  // rendered, and across borders two rows may not share a currency.
  currency: string | null;
  note: string | null;
  // Cross-border comparison. A price without these is not comparable across
  // countries: two trips and no warranty is a different offer from one trip
  // with five years, at any price.
  country: string | null;
  /** Languages the clinic's staff speak. A comparison dimension across borders:
   * a patient who cannot be understood will not travel, whatever the price. */
  spokenLanguages: string[];
  includes: string[];
  tripsRequired: number | null;
  daysPerTrip: number | null;
  weeksBetweenTrips: number | null;
  warrantyYears: number | null;
  warrantyNote: string | null;
};

/**
 * A row's amount expressed in one shared currency, or null when it cannot be.
 *
 * Both functions below take one of these rather than reading `amountMinor`
 * directly. Comparing minor units across currencies is not an approximation,
 * it is nonsense: ₺5,000 is roughly a tenth of €4,000 and its integer is
 * larger, so the raw comparison ranks the cheap quote last and pins "cheapest"
 * on the expensive one. Nothing throws, and it goes wrong precisely when the
 * cross-border feature starts working.
 */
export type ComparableAmount = (row: QuoteRow) => number | null;

/**
 * Quoted rows ascending by price.
 *
 * Rows with no quote, and rows whose currency cannot be converted, keep their
 * order at the end — an amount that cannot be compared has not been found
 * expensive, only unreadable.
 */
export function sortByPrice(rows: QuoteRow[], comparable: ComparableAmount): QuoteRow[] {
  return [...rows].sort((a, b) => {
    const x = comparable(a);
    const y = comparable(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y;
  });
}

/**
 * dentistId of the lowest quote, or null if there is nothing to crown.
 *
 * A quote that cannot be converted is not a candidate. A wrong badge is worse
 * than no badge: it recommends a clinic on the strength of a comparison that
 * was never actually made.
 */
export function cheapestDentistId(rows: QuoteRow[], comparable: ComparableAmount): string | null {
  let best: { row: QuoteRow; value: number } | null = null;
  for (const row of rows) {
    const value = comparable(row);
    if (value === null) continue;
    if (best === null || value < best.value) best = { row, value };
  }
  return best?.row.dentistId ?? null;
}

export function responseCounts(rows: QuoteRow[]): { responded: number; total: number } {
  return {
    responded: rows.filter((r) => r.amountMinor !== null).length,
    total: rows.length,
  };
}

export function quotePath(token: string): string {
  return `/quote/${token}`;
}
