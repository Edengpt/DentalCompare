import "server-only";
import { toMajor } from "@/lib/money";
import type { QuoteFormInitial } from "@/lib/quote-form-state";

/**
 * What both quote-form pages (the emailed link and the clinic area) select to
 * prefill the form — one definition, so the two can't drift into editing
 * different fields.
 */
export const QUOTE_FORM_SELECT = {
  amountMinor: true,
  currency: true,
  discountMinor: true,
  note: true,
  includes: true,
  accommodationNights: true,
  flightsIncluded: true,
  flightTickets: true,
  transfers: true,
  tripsRequired: true,
  daysPerTrip: true,
  weeksBetweenTrips: true,
  sessionsRequired: true,
  weeksBetweenSessions: true,
  warrantyYears: true,
  warrantyNote: true,
  status: true,
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
};

export const QUOTE_ATTACHMENTS_SELECT = {
  orderBy: { uploadedAt: "asc" as const },
  select: { id: true, originalName: true, contentType: true, sizeBytes: true },
};

type SelectedQuote = {
  currency: string;
  discountMinor: number | null;
  note: string | null;
  includes: string[];
  accommodationNights: number | null;
  flightsIncluded: boolean | null;
  flightTickets: number | null;
  transfers: string[];
  tripsRequired: number;
  daysPerTrip: number;
  weeksBetweenTrips: number | null;
  sessionsRequired: number;
  weeksBetweenSessions: number | null;
  warrantyYears: number | null;
  warrantyNote: string | null;
  items: {
    category: string;
    treatment: string;
    variant: string | null;
    customLabel: string | null;
    quantity: number;
    unitPriceMinor: number;
  }[];
};

export function toQuoteFormInitial(
  quote: SelectedQuote | null,
  attachments: { id: string; originalName: string; contentType: string; sizeBytes: number }[],
): QuoteFormInitial {
  const c = quote?.currency ?? "EUR";
  return {
    items: (quote?.items ?? []).map((i) => ({
      category: i.category,
      treatment: i.treatment,
      variant: i.variant,
      customLabel: i.customLabel,
      quantity: i.quantity,
      unitPrice: toMajor(i.unitPriceMinor, c),
    })),
    discount: quote?.discountMinor ? toMajor(quote.discountMinor, c) : null,
    note: quote?.note ?? null,
    includes: quote?.includes ?? [],
    accommodationNights: quote?.accommodationNights ?? null,
    flightsIncluded: quote?.flightsIncluded ?? null,
    flightTickets: quote?.flightTickets ?? null,
    transfers: quote?.transfers ?? [],
    tripsRequired: quote?.tripsRequired ?? 1,
    daysPerTrip: quote?.daysPerTrip ?? 1,
    weeksBetweenTrips: quote?.weeksBetweenTrips ?? null,
    sessionsRequired: quote?.sessionsRequired ?? 1,
    weeksBetweenSessions: quote?.weeksBetweenSessions ?? null,
    warrantyYears: quote?.warrantyYears ?? null,
    warrantyNote: quote?.warrantyNote ?? null,
    attachments: attachments.map((a) => ({
      id: a.id,
      name: a.originalName,
      contentType: a.contentType,
      sizeBytes: a.sizeBytes,
    })),
  };
}
