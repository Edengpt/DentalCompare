import { describe, it, expect } from "vitest";
import {
  minorUnitDigits,
  isSupportedCurrency,
  formatMoney,
  toMinor,
  toMajor,
  convert,
  isRateStale,
} from "./money";

describe("minorUnitDigits", () => {
  it("returns 2 for the common currencies", () => {
    expect(minorUnitDigits("ILS")).toBe(2);
    expect(minorUnitDigits("EUR")).toBe(2);
    expect(minorUnitDigits("GBP")).toBe(2);
    expect(minorUnitDigits("TRY")).toBe(2);
  });

  it("handles currencies that are not 100 minor units", () => {
    // Assuming 100 everywhere would overstate a yen amount by 100x and
    // understate a dinar amount by 10x.
    expect(minorUnitDigits("JPY")).toBe(0);
    expect(minorUnitDigits("KWD")).toBe(3);
  });

  it("falls back to 2 for an unknown code rather than throwing", () => {
    expect(minorUnitDigits("XXX")).toBe(2);
    expect(minorUnitDigits("NOPE")).toBe(2);
  });
});

describe("isSupportedCurrency", () => {
  it("accepts canonical ISO 4217 codes", () => {
    expect(isSupportedCurrency("ILS")).toBe(true);
    expect(isSupportedCurrency("EUR")).toBe(true);
  });

  it("rejects anything not in canonical form", () => {
    expect(isSupportedCurrency("ils")).toBe(false); // must be upper-case
    expect(isSupportedCurrency("")).toBe(false);
    expect(isSupportedCurrency("SHEKEL")).toBe(false);
    expect(isSupportedCurrency("IL")).toBe(false);
  });
});

describe("toMinor / toMajor", () => {
  it("round-trips a major amount through minor units", () => {
    expect(toMinor(299, "ILS")).toBe(29900);
    expect(toMajor(29900, "ILS")).toBe(299);
  });

  it("respects a zero-decimal currency", () => {
    // ¥5,000 is 5000 minor units, not 500000.
    expect(toMinor(5000, "JPY")).toBe(5000);
    expect(toMajor(5000, "JPY")).toBe(5000);
  });

  it("rounds to the nearest minor unit instead of truncating", () => {
    // Truncation biases every amount downward, which compounds across billing.
    expect(toMinor(1.006, "ILS")).toBe(101);
    expect(toMinor(1.004, "ILS")).toBe(100);
  });

  it("rounds the IEEE-754 half cases correctly", () => {
    // 1.005 * 100 is 100.49999999999999 in binary floating point, so a naive
    // Math.round loses an agora here. These pin the decimal-correct answers.
    expect(toMinor(1.005, "ILS")).toBe(101);
    expect(toMinor(1.015, "ILS")).toBe(102);
    expect(toMinor(8.165, "ILS")).toBe(817);
  });

  it("survives an amount already in exponential form", () => {
    expect(toMinor(1e-7, "ILS")).toBe(0);
    expect(toMinor(1e3, "ILS")).toBe(100000);
  });
});

describe("formatMoney", () => {
  it("renders minor units as a currency amount", () => {
    expect(formatMoney(29900, "ILS", "he")).toContain("299");
    expect(formatMoney(180000, "EUR", "en")).toContain("1,800");
  });

  it("respects currencies that are not 100 minor units", () => {
    // 5000 yen is ¥5,000 — not ¥50.
    expect(formatMoney(5000, "JPY", "en")).toContain("5,000");
  });

  it("shows the currency of the amount, never a hardcoded symbol", () => {
    expect(formatMoney(180000, "EUR", "en")).toContain("€");
    expect(formatMoney(180000, "GBP", "en")).toContain("£");
  });
});

describe("convert", () => {
  it("converts between currencies with the same minor-unit scale", () => {
    // €1,800.00 at 4.0 ILS/EUR = ₪7,200.00
    expect(convert(180000, "EUR", "ILS", 4)).toBe(720000);
  });

  it("rescales when the minor-unit digits differ", () => {
    // ¥10,000 (0 digits) at 0.025 EUR/JPY = €250.00 -> 25000 minor units
    expect(convert(10000, "JPY", "EUR", 0.025)).toBe(25000);
  });

  it("rounds to the nearest minor unit rather than truncating", () => {
    expect(convert(100, "EUR", "ILS", 3.999)).toBe(400);
  });

  it("is a no-op when the currencies match, whatever the rate says", () => {
    // Guards against a stale or wrong self-rate silently rewriting an amount.
    expect(convert(29900, "ILS", "ILS", 1)).toBe(29900);
    expect(convert(29900, "ILS", "ILS", 3.7)).toBe(29900);
  });
});

describe("isRateStale", () => {
  it("accepts a rate fetched today", () => {
    expect(
      isRateStale(new Date("2026-08-20T09:00:00Z"), new Date("2026-08-20T12:00:00Z")),
    ).toBe(false);
  });

  it("accepts a rate just inside the window, so a late cron isn't punished", () => {
    expect(
      isRateStale(new Date("2026-08-18T13:00:00Z"), new Date("2026-08-20T12:00:00Z")),
    ).toBe(false);
  });

  it("keeps a few days' old rate, so a failed refresh doesn't blank every comparison", () => {
    expect(
      isRateStale(new Date("2026-08-17T09:00:00Z"), new Date("2026-08-20T12:00:00Z")),
    ).toBe(false);
  });

  it("rejects a rate older than 14 days", () => {
    expect(
      isRateStale(new Date("2026-08-06T11:00:00Z"), new Date("2026-08-20T12:00:00Z")),
    ).toBe(true);
  });
});
