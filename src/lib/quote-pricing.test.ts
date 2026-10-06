import { describe, it, expect } from "vitest";
import { computeQuoteTotals } from "./quote-pricing";

describe("computeQuoteTotals", () => {
  it("sums lines in minor units", () => {
    const r = computeQuoteTotals(
      [
        { quantity: 3, unitPriceMajor: 800 },
        { quantity: 3, unitPriceMajor: 300 },
      ],
      null,
      "EUR",
    );
    expect(r).toMatchObject({
      ok: true,
      subtotalMinor: 330000,
      discountMinor: 0,
      finalMinor: 330000,
      lines: [
        { unitPriceMinor: 80000, lineTotalMinor: 240000 },
        { unitPriceMinor: 30000, lineTotalMinor: 90000 },
      ],
    });
  });

  it("applies a package discount", () => {
    const r = computeQuoteTotals([{ quantity: 1, unitPriceMajor: 3300 }], 300, "EUR");
    expect(r).toMatchObject({
      ok: true,
      subtotalMinor: 330000,
      discountMinor: 30000,
      finalMinor: 300000,
    });
  });

  it("respects the currency's minor-unit scale and rounding", () => {
    expect(computeQuoteTotals([{ quantity: 2, unitPriceMajor: 5000 }], null, "JPY")).toMatchObject({
      finalMinor: 10000,
    });
    expect(computeQuoteTotals([{ quantity: 1, unitPriceMajor: 1.005 }], null, "EUR")).toMatchObject(
      {
        finalMinor: 101,
      },
    );
  });

  it("allows a free line but not a free quote", () => {
    expect(
      computeQuoteTotals(
        [
          { quantity: 1, unitPriceMajor: 0 },
          { quantity: 1, unitPriceMajor: 100 },
        ],
        null,
        "EUR",
      ),
    ).toMatchObject({ ok: true, finalMinor: 10000 });
    expect(computeQuoteTotals([{ quantity: 1, unitPriceMajor: 0 }], null, "EUR")).toEqual({
      ok: false,
      error: "NO_LINES",
    });
    expect(computeQuoteTotals([], null, "EUR")).toEqual({ ok: false, error: "NO_LINES" });
  });

  it("rejects bad quantities and prices", () => {
    for (const line of [
      { quantity: 0, unitPriceMajor: 10 },
      { quantity: 1.5, unitPriceMajor: 10 },
      { quantity: 100, unitPriceMajor: 10 },
      { quantity: 1, unitPriceMajor: -1 },
      { quantity: 1, unitPriceMajor: NaN },
    ]) {
      expect(computeQuoteTotals([line], null, "EUR")).toEqual({ ok: false, error: "BAD_LINE" });
    }
  });

  it("never lets a discount reach or pass the subtotal", () => {
    const lines = [{ quantity: 1, unitPriceMajor: 100 }];
    expect(computeQuoteTotals(lines, 100, "EUR")).toEqual({ ok: false, error: "BAD_DISCOUNT" });
    expect(computeQuoteTotals(lines, 150, "EUR")).toEqual({ ok: false, error: "BAD_DISCOUNT" });
    expect(computeQuoteTotals(lines, -5, "EUR")).toEqual({ ok: false, error: "BAD_DISCOUNT" });
    expect(computeQuoteTotals(lines, 0, "EUR")).toMatchObject({ ok: true, discountMinor: 0 });
  });

  it("enforces the price ceiling on the subtotal", () => {
    expect(computeQuoteTotals([{ quantity: 2, unitPriceMajor: 600_000 }], null, "EUR")).toEqual({
      ok: false,
      error: "TOO_HIGH",
    });
    expect(computeQuoteTotals([{ quantity: 1, unitPriceMajor: 1_000_001 }], null, "EUR")).toEqual({
      ok: false,
      error: "TOO_HIGH",
    });
  });
});
