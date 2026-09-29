import { describe, it, expect } from "vitest";
import {
  foundingPriceMinor,
  foundingEndFrom,
  isFoundingNoticeDue,
  effectivePriceMinor,
  stripeCouponMonths,
} from "./founding";

describe("foundingPriceMinor", () => {
  it("takes a third off and rounds to a whole unit", () => {
    expect(foundingPriceMinor(29900, "ILS")).toBe(19900);
    expect(foundingPriceMinor(7900, "USD")).toBe(5300);
    expect(foundingPriceMinor(199000, "ILS")).toBe(132700);
  });
});

describe("foundingEndFrom", () => {
  it("is twelve months after the first charge", () => {
    expect(foundingEndFrom(new Date("2026-10-15T09:00:00Z")).toISOString()).toBe(
      "2027-10-15T09:00:00.000Z",
    );
  });
});

describe("isFoundingNoticeDue", () => {
  const endsAt = new Date("2027-10-15T00:00:00Z");
  const base = { isFounding: true, foundingEndsAt: endsAt, foundingNoticeSentAt: null };

  it("fires inside the last 30 days, once", () => {
    expect(isFoundingNoticeDue(base, new Date("2027-09-20T00:00:00Z"))).toBe(true);
    expect(
      isFoundingNoticeDue(
        { ...base, foundingNoticeSentAt: new Date("2027-09-16T00:00:00Z") },
        new Date("2027-09-20T00:00:00Z"),
      ),
    ).toBe(false);
  });

  it("stays quiet too early, after the end, and for regular clinics", () => {
    expect(isFoundingNoticeDue(base, new Date("2027-08-01T00:00:00Z"))).toBe(false);
    expect(isFoundingNoticeDue(base, new Date("2027-10-16T00:00:00Z"))).toBe(false);
    expect(
      isFoundingNoticeDue({ ...base, isFounding: false }, new Date("2027-09-20T00:00:00Z")),
    ).toBe(false);
  });
});

describe("effectivePriceMinor", () => {
  const sub = {
    priceMinor: 19900,
    isFounding: true,
    regularPriceMinor: 29900,
    foundingEndsAt: new Date("2027-10-15T00:00:00Z"),
  };

  it("charges the founding price until the end, the regular one after", () => {
    expect(effectivePriceMinor(sub, new Date("2027-10-14T00:00:00Z"))).toBe(19900);
    expect(effectivePriceMinor(sub, new Date("2027-10-15T00:00:00Z"))).toBe(29900);
  });

  it("leaves regular subscriptions alone", () => {
    expect(
      effectivePriceMinor(
        { priceMinor: 29900, isFounding: false, regularPriceMinor: null, foundingEndsAt: null },
        new Date(),
      ),
    ).toBe(29900);
  });
});

describe("stripeCouponMonths", () => {
  it("covers the trial plus twelve monthly invoices, or the first yearly one", () => {
    expect(stripeCouponMonths(60, "MONTHLY")).toBe(14);
    expect(stripeCouponMonths(60, "YEARLY")).toBe(3);
    expect(stripeCouponMonths(7, "MONTHLY")).toBe(13);
  });
});
