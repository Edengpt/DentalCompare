import { describe, it, expect } from "vitest";
import { warrantyEndsAt } from "./warranty";

describe("warrantyEndsAt", () => {
  it("counts the stated years from completion", () => {
    expect(warrantyEndsAt(new Date("2026-10-15T10:00:00Z"), 5)?.toISOString()).toBe(
      "2031-10-15T10:00:00.000Z",
    );
  });

  it("has no date before completion or without a warranty", () => {
    expect(warrantyEndsAt(null, 5)).toBeNull();
    expect(warrantyEndsAt(new Date(), null)).toBeNull();
    expect(warrantyEndsAt(new Date(), 0)).toBeNull();
  });
});
