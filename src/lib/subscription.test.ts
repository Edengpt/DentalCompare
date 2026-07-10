import { describe, it, expect } from "vitest";
import {
  planPriceILS,
  addMonths,
  nextPeriodEnd,
  isDueForRenewal,
  isClinicVisible,
  isWithinGrace,
  graceCutoff,
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

  it("keeps a PAST_DUE clinic within grace (3 days) and cuts it off after", () => {
    const end = new Date("2026-06-10T00:00:00Z");
    // 2 days after period end → still in grace (3-day window).
    expect(isWithinGrace(end, new Date("2026-06-12T00:00:00Z"))).toBe(true);
    // 4 days after → outside grace.
    expect(isWithinGrace(end, new Date("2026-06-14T00:00:01Z"))).toBe(false);
    expect(isWithinGrace(null, new Date("2026-06-12T00:00:00Z"))).toBe(false);
  });

  it("treats ACTIVE, and PAST_DUE-in-grace, as visible; PENDING/lapsed/null as not", () => {
    const end = new Date("2026-06-10T00:00:00Z");
    const inGrace = new Date("2026-06-12T00:00:00Z");
    const afterGrace = new Date("2026-06-20T00:00:00Z");

    expect(isClinicVisible({ status: "ACTIVE" }, inGrace)).toBe(true);
    expect(isClinicVisible({ status: "PAST_DUE", currentPeriodEnd: end }, inGrace)).toBe(true);
    expect(isClinicVisible({ status: "PAST_DUE", currentPeriodEnd: end }, afterGrace)).toBe(false);
    expect(isClinicVisible({ status: "PAST_DUE" }, inGrace)).toBe(false); // no period end
    expect(isClinicVisible({ status: "PENDING" }, inGrace)).toBe(false);
    expect(isClinicVisible(null, inGrace)).toBe(false);
  });

  it("graceCutoff is PAST_DUE_GRACE_DAYS before now", () => {
    const now = new Date("2026-06-20T00:00:00Z");
    expect(graceCutoff(now).toISOString()).toBe("2026-06-17T00:00:00.000Z");
  });
});
