import type { QuoteAttachmentInfo } from "./quote-attachments";
import { computeQuoteTotals } from "./quote-pricing";

/**
 * The quote form's state rules, kept out of the components so they can be
 * tested in the node test environment (there is no DOM runner here).
 *
 * Client-safe: no database or server imports.
 */

/** A treatment line as stored, prices in major units — what the form starts from. */
export type QuoteFormItem = {
  category: string;
  treatment: string;
  variant: string | null;
  customLabel: string | null;
  quantity: number;
  unitPrice: number;
};

export type QuoteFormInitial = {
  items: QuoteFormItem[];
  /** Major units; null = no discount. */
  discount: number | null;
  note: string | null;
  includes: string[];
  accommodationNights: number | null;
  /** Null on a legacy quote, so the clinic is made to answer on its next edit. */
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
  attachments: QuoteAttachmentInfo[];
};

/** A line while it is being edited: inputs hold strings, and each line needs a stable key. */
export type QuoteFormLine = Omit<QuoteFormItem, "quantity" | "unitPrice"> & {
  key: string;
  quantity: string;
  unitPrice: string;
};

let nextKey = 0;
function lineKey(): string {
  nextKey += 1;
  return `line-${nextKey}`;
}

export function newLine(pick: {
  category: string;
  treatment: string;
  variant?: string | null;
  customLabel?: string | null;
}): QuoteFormLine {
  return {
    key: lineKey(),
    category: pick.category,
    treatment: pick.treatment,
    variant: pick.variant ?? null,
    customLabel: pick.customLabel?.trim() || null,
    quantity: "1",
    unitPrice: "",
  };
}

export function initialLines(items: QuoteFormItem[]): QuoteFormLine[] {
  return items.map((i) => ({
    ...i,
    key: lineKey(),
    quantity: String(i.quantity),
    unitPrice: String(i.unitPrice),
  }));
}

/**
 * Transfers to start from. A legacy quote recorded the airport pickup as the
 * AIRPORT_TRANSFER inclusion; it is carried over so editing that quote doesn't
 * silently drop it.
 */
export function initialTransfers(initial: Pick<QuoteFormInitial, "transfers" | "includes">) {
  const out = new Set(initial.transfers);
  if (initial.includes.includes("AIRPORT_TRANSFER")) out.add("AIRPORT_HOTEL");
  return [...out];
}

/** An empty price input is "not priced yet", which the totals treat as invalid. */
function num(value: string): number {
  return value.trim() === "" ? NaN : Number(value);
}

/** The lines as computeQuoteTotals and submitQuote want them. */
export function linesPayload(lines: QuoteFormLine[]) {
  return lines.map((l) => ({
    category: l.category,
    treatment: l.treatment,
    variant: l.variant,
    customLabel: l.customLabel,
    quantity: num(l.quantity),
    unitPriceMajor: num(l.unitPrice),
  }));
}

export function parseDiscount(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

/** The live totals for the summary — the same function the server prices with. */
export function formTotals(lines: QuoteFormLine[], discount: string, currency: string) {
  return computeQuoteTotals(linesPayload(lines), parseDiscount(discount), currency);
}
