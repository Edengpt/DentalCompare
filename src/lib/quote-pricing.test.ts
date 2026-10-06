import { describe, it, expect } from "vitest";
import { computeQuoteTotals, DB_SAFE_MAX_MINOR, priceCeilingMinor } from "./quote-pricing";

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

  it("enforces the ceiling it is given on unit price and subtotal", () => {
    const ceiling = 100_000; // EUR 1,000.00
    expect(
      computeQuoteTotals([{ quantity: 2, unitPriceMajor: 600 }], null, "EUR", ceiling),
    ).toEqual({
      ok: false,
      error: "TOO_HIGH",
    });
    expect(
      computeQuoteTotals([{ quantity: 1, unitPriceMajor: 1001 }], null, "EUR", ceiling),
    ).toEqual({
      ok: false,
      error: "TOO_HIGH",
    });
    expect(
      computeQuoteTotals([{ quantity: 1, unitPriceMajor: 1000 }], null, "EUR", ceiling),
    ).toMatchObject({
      ok: true,
    });
  });

  // The bug this replaced: a flat 1,000,000 in the clinic's own currency is
  // about EUR 2,500 in forint. A full mouth of implants in Budapest is far more.
  it("lets a Hungarian clinic quote a full-mouth job in forint", () => {
    const r = computeQuoteTotals([{ quantity: 8, unitPriceMajor: 1_500_000 }], null, "HUF");
    expect(r).toMatchObject({ ok: true, finalMinor: 1_200_000_000 });
  });

  it("never lets a price outgrow the database column", () => {
    expect(computeQuoteTotals([{ quantity: 1, unitPriceMajor: 25_000_000 }], null, "HUF")).toEqual({
      ok: false,
      error: "TOO_HIGH",
    });
  });
});

describe("priceCeilingMinor", () => {
  it("uses the euro limit converted into the currency", () => {
    expect(priceCeilingMinor(25_000_000)).toBe(25_000_000);
  });
  it("caps at what the database column holds", () => {
    expect(priceCeilingMinor(9_000_000_000)).toBe(DB_SAFE_MAX_MINOR);
  });
  it("falls back to the database limit when there is no usable rate", () => {
    expect(priceCeilingMinor(null)).toBe(DB_SAFE_MAX_MINOR);
  });
});
