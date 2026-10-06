import { describe, it, expect } from "vitest";
import { comparisonPrice, patientCurrencyFor, ratesToFetch } from "./price-display";

const fetchedAt = new Date("2026-10-04T04:00:00Z");

describe("comparisonPrice", () => {
  it("leads with the patient's currency when a rate exists", () => {
    expect(
      comparisonPrice(
        { amountMinor: 90000000, currency: "HUF" },
        { minor: 230000, fetchedAt },
        "EUR",
      ),
    ).toEqual({
      headline: { minor: 230000, currency: "EUR" },
      approximate: true,
      clinicPrice: { minor: 90000000, currency: "HUF" },
      rateDate: fetchedAt,
    });
  });

  it("shows the clinic's price alone when it is already in the patient's currency", () => {
    expect(
      comparisonPrice(
        { amountMinor: 450000, currency: "EUR" },
        { minor: 450000, fetchedAt },
        "EUR",
      ),
    ).toEqual({
      headline: { minor: 450000, currency: "EUR" },
      approximate: false,
      clinicPrice: null,
      rateDate: null,
    });
  });

  it("falls back to the clinic's price when there is no usable rate", () => {
    expect(comparisonPrice({ amountMinor: 7000000, currency: "TRY" }, null, "EUR")).toEqual({
      headline: { minor: 7000000, currency: "TRY" },
      approximate: false,
      clinicPrice: null,
      rateDate: null,
    });
  });
});

describe("patientCurrencyFor", () => {
  it("uses the currency of the patient's country", () => {
    expect(patientCurrencyFor("GBP")).toBe("GBP");
  });

  it("uses US dollars when the patient has no country, never a home market's currency", () => {
    expect(patientCurrencyFor(null)).toBe("USD");
    expect(patientCurrencyFor(undefined)).toBe("USD");
  });
});

describe("ratesToFetch", () => {
  it("always includes the fallback currency, even when no clinic country uses it", () => {
    expect(ratesToFetch(["TRY", "EUR", "GBP", "EUR"])).toEqual({
      base: "EUR",
      quotes: ["GBP", "TRY", "USD"],
    });
  });

  it("still fetches when only one clinic currency is active", () => {
    expect(ratesToFetch(["HUF"])).toEqual({ base: "HUF", quotes: ["USD"] });
  });

  it("has nothing to fetch when the only currency is the fallback itself", () => {
    expect(ratesToFetch(["USD"])).toBeNull();
    expect(ratesToFetch([])).toBeNull();
  });
});
