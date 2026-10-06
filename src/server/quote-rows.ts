import type { QuoteRow } from "@/lib/quotes";

/**
 * The structured parts of a quote the comparison table shows: its treatment
 * lines, the discount, travel and documents. Shared by the request page and
 * the treatment page, so the two selects can't drift into showing a patient
 * different things about the same quote.
 */
export const QUOTE_DETAIL_SELECT = {
  discountMinor: true,
  flightsIncluded: true,
  flightTickets: true,
  transfers: true,
  items: {
    orderBy: { position: "asc" as const },
    select: {
      category: true,
      treatment: true,
      variant: true,
      customLabel: true,
      quantity: true,
      unitPriceMinor: true,
    },
  },
} as const;

/** Selected on RequestDentist — documents hang off it, not off the quote. */
export const QUOTE_ROW_ATTACHMENTS_SELECT = {
  orderBy: { uploadedAt: "asc" as const },
  select: { id: true, originalName: true, contentType: true },
} as const;

type DetailQuote = {
  discountMinor: number | null;
  flightsIncluded: boolean | null;
  flightTickets: number | null;
  transfers: string[];
  items: QuoteRow["items"];
};

export function quoteDetailFields(
  quote: DetailQuote | null,
  attachments: { id: string; originalName: string; contentType: string }[],
): Pick<
  QuoteRow,
  "items" | "discountMinor" | "flightsIncluded" | "flightTickets" | "transfers" | "attachments"
> {
  return {
    items: quote?.items ?? [],
    discountMinor: quote?.discountMinor ?? null,
    flightsIncluded: quote?.flightsIncluded ?? null,
    flightTickets: quote?.flightTickets ?? null,
    transfers: quote?.transfers ?? [],
    // Documents are the clinic's draft until its quote is submitted — the
    // download route refuses them before then, so they aren't listed either.
    attachments: quote
      ? attachments.map((a) => ({ id: a.id, name: a.originalName, contentType: a.contentType }))
      : [],
  };
}
