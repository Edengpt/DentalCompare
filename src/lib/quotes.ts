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
};

/** Quoted rows ascending by price; un-quoted rows keep their order at the end. */
export function sortByPrice(rows: QuoteRow[]): QuoteRow[] {
  return [...rows].sort((a, b) => {
    if (a.amountMinor === null && b.amountMinor === null) return 0;
    if (a.amountMinor === null) return 1;
    if (b.amountMinor === null) return -1;
    return a.amountMinor - b.amountMinor;
  });
}

/** dentistId of the lowest quote, or null if nobody has quoted yet. */
export function cheapestDentistId(rows: QuoteRow[]): string | null {
  let best: QuoteRow | null = null;
  for (const r of rows) {
    if (r.amountMinor === null) continue;
    if (best === null || r.amountMinor < best.amountMinor!) best = r;
  }
  return best?.dentistId ?? null;
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
