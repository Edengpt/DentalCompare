import { describe, it, expect } from "vitest";
import {
  planPriceILS,
  addMonths,
  nextPeriodEnd,
  isDueForRenewal,
  isClinicVisible,
} from "./subscription";

describe("subscription helpers", () => {
  it("returns the configured price per plan", () => {
    expect(planPriceILS("MONTHLY")).toBe(299);
    expect(planPriceILS("YEARLY")).toBe(1990);
  });

  it("adds months and clamps end-of-month overflow", () => {
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString()).toBe(
      "2026-02-28T00:00:00.000Z",
    );
    expect(addMonths(new Date("2026-03-15T00:00:00Z"), 12).toISOString()).toBe(
      "2027-03-15T00:00:00.000Z",
    );
  });

  it("computes next period end from plan interval", () => {
    const from = new Date("2026-06-01T00:00:00Z");
    expect(nextPeriodEnd(from, "MONTHLY").toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(nextPeriodEnd(from, "YEARLY").toISOString()).toBe("2027-06-01T00:00:00.000Z");
  });

  it("is due for renewal within the lead window, not before", () => {
    const end = new Date("2026-06-10T00:00:00Z");
    expect(isDueForRenewal(end, new Date("2026-06-09T12:00:00Z"))).toBe(true); // within 1 day
    expect(isDueForRenewal(end, new Date("2026-06-08T00:00:00Z"))).toBe(false); // 2 days out
    expect(isDueForRenewal(end, new Date("2026-06-11T00:00:00Z"))).toBe(true); // already past
  });

  it("only treats ACTIVE subscriptions as visible", () => {
    expect(isClinicVisible({ status: "ACTIVE" })).toBe(true);
    expect(isClinicVisible({ status: "PAST_DUE" })).toBe(false);
    expect(isClinicVisible({ status: "PENDING" })).toBe(false);
    expect(isClinicVisible(null)).toBe(false);
  });
});
