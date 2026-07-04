export type QuoteRow = {
  dentistId: string;
  dentistName: string;
  clinicName: string;
  city: string;
  amountILS: number | null;
  note: string | null;
};

/** Quoted rows ascending by price; un-quoted rows keep their order at the end. */
export function sortByPrice(rows: QuoteRow[]): QuoteRow[] {
  return [...rows].sort((a, b) => {
    if (a.amountILS === null && b.amountILS === null) return 0;
    if (a.amountILS === null) return 1;
    if (b.amountILS === null) return -1;
    return a.amountILS - b.amountILS;
  });
}

/** dentistId of the lowest quote, or null if nobody has quoted yet. */
export function cheapestDentistId(rows: QuoteRow[]): string | null {
  let best: QuoteRow | null = null;
  for (const r of rows) {
    if (r.amountILS === null) continue;
    if (best === null || r.amountILS < best.amountILS!) best = r;
  }
  return best?.dentistId ?? null;
}

export function responseCounts(rows: QuoteRow[]): { responded: number; total: number } {
  return {
    responded: rows.filter((r) => r.amountILS !== null).length,
    total: rows.length,
  };
}

export function quotePath(token: string): string {
  return `/quote/${token}`;
}
