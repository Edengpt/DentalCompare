import { describe, it, expect } from "vitest";
import { findRate } from "./exchange";

const fresh = new Date("2026-08-23T04:00:00Z");
const now = new Date("2026-08-23T10:00:00Z");

// What the cron actually leaves behind: one base, and a row per other currency.
// There is no ILS -> EUR row and no ILS -> TRY row, ever.
const rates = [
  { base: "EUR", quote: "ILS", rate: 4, fetchedAt: fresh },
  { base: "EUR", quote: "TRY", rate: 40, fetchedAt: fresh },
];

describe("findRate", () => {
  it("returns 1 for the same currency, with no stored row needed", () => {
    expect(findRate([], "ILS", "ILS", now)?.rate).toBe(1);
  });

  it("reads a stored row directly", () => {
    expect(findRate(rates, "EUR", "ILS", now)?.rate).toBe(4);
  });

  it("inverts a stored row for the other direction", () => {
    expect(findRate(rates, "ILS", "EUR", now)?.rate).toBeCloseTo(0.25);
  });

  // Neither side is the base, so the only route is ILS -> EUR -> TRY.
  it("triangulates through the base", () => {
    expect(findRate(rates, "ILS", "TRY", now)?.rate).toBeCloseTo(10);
  });

  it("triangulates in the other direction too", () => {
    expect(findRate(rates, "TRY", "ILS", now)?.rate).toBeCloseTo(0.1);
  });

  it("has no rate for a currency it has never seen", () => {
    expect(findRate(rates, "ILS", "JPY", now)).toBeNull();
    expect(findRate(rates, "JPY", "ILS", now)).toBeNull();
  });

  // A figure shown to a patient as a price must not be two days old.
  it("refuses a rate older than the staleness window", () => {
    const old = [{ base: "EUR", quote: "ILS", rate: 4, fetchedAt: new Date("2026-08-20") }];
    expect(findRate(old, "EUR", "ILS", now)).toBeNull();
  });

  it("refuses a triangulation when either leg is stale", () => {
    const oneStale = [
      { base: "EUR", quote: "ILS", rate: 4, fetchedAt: new Date("2026-08-20") },
      { base: "EUR", quote: "TRY", rate: 40, fetchedAt: fresh },
    ];
    expect(findRate(oneStale, "ILS", "TRY", now)).toBeNull();
  });

  // A triangulated rate is only as current as its oldest leg, and the date is
  // shown to the patient — so it has to be the honest one.
  it("reports the older of the two legs when triangulating", () => {
    const older = new Date("2026-08-23T02:00:00Z");
    const mixed = [
      { base: "EUR", quote: "ILS", rate: 4, fetchedAt: older },
      { base: "EUR", quote: "TRY", rate: 40, fetchedAt: fresh },
    ];
    expect(findRate(mixed, "ILS", "TRY", now)?.fetchedAt).toEqual(older);
  });

  // Same currency short-circuits before any row is consulted, so a stale or
  // wrong self-rate can never rewrite an amount.
  it("returns 1 for the same currency even when every stored rate is stale", () => {
    const old = [{ base: "EUR", quote: "ILS", rate: 4, fetchedAt: new Date("2020-01-01") }];
    expect(findRate(old, "ILS", "ILS", now)?.rate).toBe(1);
  });
});
