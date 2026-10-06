import type { QuoteStatus } from "@/generated/prisma/enums";

export type QuoteRow = {
  dentistId: string;
  requestDentistId: string;
  status: QuoteStatus | null; // null when no Quote exists yet
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
  /** Only meaningful when `includes` contains "ACCOMMODATION". */
  accommodationNights: number | null;
  tripsRequired: number | null;
  daysPerTrip: number | null;
  weeksBetweenTrips: number | null;
  /** How many separate clinic visits the treatment needs — independent of
   * tripsRequired; relevant even when the patient never travels. */
  sessionsRequired: number | null;
  weeksBetweenSessions: number | null;
  warrantyYears: number | null;
  warrantyNote: string | null;
  /** Declined by the system when the patient approved another quote, not by the patient. */
  rejectedAuto: boolean;
  /** Treatment lines, in the clinic's order. Empty on a legacy quote. */
  items: {
    category: string;
    treatment: string;
    variant: string | null;
    customLabel: string | null;
    quantity: number;
    /** In `currency`. */
    unitPriceMinor: number;
  }[];
  /** Package discount; the subtotal is amountMinor + discountMinor. */
  discountMinor: number | null;
  /** Null on a legacy quote that never answered. */
  flightsIncluded: boolean | null;
  flightTickets: number | null;
  transfers: string[];
  /** Documents the clinic attached; served by /api/quote-attachments/[id]. */
  attachments: { id: string; name: string; contentType: string }[];
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
