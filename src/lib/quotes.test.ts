import { describe, it, expect } from "vitest";
import { sortByPrice, cheapestDentistId, responseCounts, quotePath, type QuoteRow } from "./quotes";

const row = (dentistId: string, amountMinor: number | null): QuoteRow => ({
  dentistId,
  requestDentistId: `rd-${dentistId}`,
  status: null,
  dentistName: `Dr ${dentistId}`,
  clinicName: `Clinic ${dentistId}`,
  city: "תל אביב",
  amountMinor,
  currency: amountMinor === null ? null : "ILS",
  note: null,
  country: "Israel",
  spokenLanguages: [],
  includes: [],
  accommodationNights: null,
  tripsRequired: 1,
  daysPerTrip: 1,
  weeksBetweenTrips: null,
  sessionsRequired: 1,
  weeksBetweenSessions: null,
  warrantyYears: null,
  warrantyNote: null,
  rejectedAuto: false,
  items: [],
  discountMinor: null,
  flightsIncluded: null,
  flightTickets: null,
  transfers: [],
  attachments: [],
});

/** Every row here is priced in one currency, so the stored amount compares directly. */
const sameCurrency = (r: { amountMinor: number | null }) => r.amountMinor;

describe("quote comparison helpers", () => {
  it("sorts quoted rows cheapest-first and puts un-quoted rows last", () => {
    const rows = [row("a", null), row("b", 9800), row("c", 7200)];
    expect(sortByPrice(rows, sameCurrency).map((r) => r.dentistId)).toEqual(["c", "b", "a"]);
  });

  it("returns the cheapest quoted dentist id, or null when none quoted", () => {
    expect(cheapestDentistId([row("a", null), row("b", 9800), row("c", 7200)], sameCurrency)).toBe(
      "c",
    );
    expect(cheapestDentistId([row("a", null), row("b", null)], sameCurrency)).toBeNull();
  });

  it("counts responded vs total", () => {
    expect(responseCounts([row("a", null), row("b", 9800), row("c", 7200)])).toEqual({
      responded: 2,
      total: 3,
    });
  });

  it("builds the quote form path", () => {
    expect(quotePath("abc-123")).toBe("/quote/abc-123");
  });
});

describe("comparing across currencies", () => {
  const row = (dentistId: string, amountMinor: number | null, currency: string | null): QuoteRow =>
    ({
      dentistId,
      requestDentistId: `rd-${dentistId}`,
      status: null,
      dentistName: dentistId,
      clinicName: dentistId,
      city: "",
      amountMinor,
      currency,
      note: null,
      country: null,
      spokenLanguages: [],
      includes: [],
      accommodationNights: null,
      tripsRequired: null,
      daysPerTrip: null,
      weeksBetweenTrips: null,
      sessionsRequired: null,
      weeksBetweenSessions: null,
      warrantyYears: null,
      warrantyNote: null,
      rejectedAuto: false,
      items: [],
      discountMinor: null,
      flightsIncluded: null,
      flightTickets: null,
      transfers: [],
      attachments: [],
    }) as QuoteRow;

  // ₺5,000 is roughly a tenth of €4,000, but its minor-unit integer is larger.
  // Comparing the raw numbers puts the cheap quote last and pins "cheapest" on
  // the expensive one — silently, and precisely when the feature matters.
  const RATES: Record<string, number> = { TRY: 1, EUR: 40 };
  const comparable = (r: QuoteRow) =>
    r.amountMinor !== null && r.currency && RATES[r.currency] !== undefined
      ? r.amountMinor * RATES[r.currency]
      : null;

  const turkish = row("turkish", 500_000, "TRY"); // ₺5,000
  const french = row("french", 400_000, "EUR"); // €4,000

  it("ranks by what the money is worth, not by the size of the integer", () => {
    const sorted = sortByPrice([french, turkish], comparable);
    expect(sorted.map((r) => r.dentistId)).toEqual(["turkish", "french"]);
  });

  it("names the genuinely cheapest clinic", () => {
    expect(cheapestDentistId([french, turkish], comparable)).toBe("turkish");
  });

  // A wrong badge is worse than no badge: it recommends a clinic on the basis
  // of a comparison that was never made.
  it("does not crown a quote it cannot convert", () => {
    const unconvertible = row("mystery", 1, "XYZ");
    expect(cheapestDentistId([french, unconvertible], comparable)).toBe("french");
  });

  it("leaves quotes it cannot convert at the end, with the unanswered ones", () => {
    const unconvertible = row("mystery", 1, "XYZ");
    const noQuote = row("silent", null, null);
    const sorted = sortByPrice([unconvertible, french, noQuote], comparable);
    expect(sorted[0].dentistId).toBe("french");
  });
});
