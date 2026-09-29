import { describe, it, expect } from "vitest";
import { costPerRequestMinor, nextMonthStart } from "./clinic-usage";

describe("costPerRequestMinor", () => {
  it("divides the monthly price by the requests received", () => {
    expect(costPerRequestMinor(29900, "MONTHLY", 8)).toBe(3738);
  });

  it("spreads a yearly price over twelve months", () => {
    expect(costPerRequestMinor(199000, "YEARLY", 10)).toBe(1658);
  });

  it("has nothing to say with no requests or a free plan", () => {
    expect(costPerRequestMinor(29900, "MONTHLY", 0)).toBeNull();
    expect(costPerRequestMinor(0, "MONTHLY", 3)).toBeNull();
  });
});

describe("nextMonthStart", () => {
  it("is the first of the following month, across a year end", () => {
    expect(nextMonthStart(new Date("2026-09-29T12:00:00Z")).toISOString()).toBe(
      "2026-10-01T00:00:00.000Z",
    );
    expect(nextMonthStart(new Date("2026-12-31T23:00:00Z")).toISOString()).toBe(
      "2027-01-01T00:00:00.000Z",
    );
  });
});
