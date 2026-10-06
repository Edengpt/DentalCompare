import { describe, it, expect } from "vitest";
import {
  chooseComparisonCurrency,
  comparisonPrice,
  patientCurrencyFor,
  ratesToFetch,
} from "./price-display";

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
  it("uses the currency of the patient's country, wherever it is", () => {
    expect(patientCurrencyFor("GB")).toBe("GBP");
    expect(patientCurrencyFor("BR")).toBe("BRL");
    expect(patientCurrencyFor("DE")).toBe("EUR");
  });

  it("uses US dollars when the patient has no country, never a home market's currency", () => {
    expect(patientCurrencyFor(null)).toBe("USD");
    expect(patientCurrencyFor(undefined)).toBe("USD");
  });

  it("uses US dollars for a code it doesn't know", () => {
    expect(patientCurrencyFor("XX")).toBe("USD");
  });
});

describe("ratesToFetch", () => {
  // Always EUR: the rate source is the ECB, and a fixed base means one set of
  // rows, never two bases mixed after a new currency happens to sort first.
  it("always uses EUR as the base and includes the fallback", () => {
    expect(ratesToFetch(["TRY", "EUR", "GBP", "BRL", "TRY"])).toEqual({
      base: "EUR",
      quotes: ["BRL", "GBP", "TRY", "USD"],
    });
  });

  it("still fetches the fallback with no other currency", () => {
    expect(ratesToFetch([])).toEqual({ base: "EUR", quotes: ["USD"] });
  });
});

describe("chooseComparisonCurrency", () => {
  const quotes = [
    { amountMinor: 7000000, currency: "TRY" },
    { amountMinor: 630000, currency: "GBP" },
  ];
  const converts = () => ({ minor: 1, fetchedAt });
  const never = () => null;

  it("keeps the patient's currency when every quote converts into it", () => {
    expect(chooseComparisonCurrency("BRL", quotes, converts, converts)).toBe("BRL");
  });

  // Nigerian naira has no ECB rate: three unconverted prices compare nothing.
  it("switches to US dollars when the patient's currency has no rates", () => {
    expect(chooseComparisonCurrency("NGN", quotes, never, converts)).toBe("USD");
  });

  it("stays put when dollars don't help either", () => {
    expect(chooseComparisonCurrency("NGN", quotes, never, never)).toBe("NGN");
  });

  it("needs no rate for a quote already in the patient's currency", () => {
    expect(
      chooseComparisonCurrency("TRY", [{ amountMinor: 1, currency: "TRY" }], never, converts),
    ).toBe("TRY");
  });
});
