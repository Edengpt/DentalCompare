import { describe, it, expect } from "vitest";
import { normalizeIsraeliMobile, formatIsraeliMobileForDisplay } from "./phone";

describe("normalizeIsraeliMobile", () => {
  it("normalises the common local formats to E.164", () => {
    for (const input of [
      "0501234567",
      "050-123-4567",
      "050 123 4567",
      "+972501234567",
      "+972-50-123-4567",
      "972501234567",
      "00972501234567",
    ]) {
      expect(normalizeIsraeliMobile(input)).toBe("+972501234567");
    }
  });

  it("accepts every allocated mobile prefix", () => {
    for (const p of ["050", "051", "052", "053", "054", "055", "056", "058", "059"]) {
      expect(normalizeIsraeliMobile(`${p}1234567`)).toBe(`+972${p.slice(1)}1234567`);
    }
  });

  it("rejects landlines — a clinic calling back a landline is not the gate we want", () => {
    for (const input of ["031234567", "0212345678", "089123456", "+97231234567"]) {
      expect(normalizeIsraeliMobile(input)).toBeNull();
    }
  });

  it("rejects wrong lengths, foreign numbers and junk", () => {
    for (const input of [
      "050123456", // one digit short
      "05012345678", // one digit long
      "+14155552671", // US
      "+972401234567", // 04 prefix, not mobile
      "",
      "   ",
      "not a phone",
      "05a1234567",
    ]) {
      expect(normalizeIsraeliMobile(input)).toBeNull();
    }
  });

  it("is idempotent — normalising an already-normalised number is a no-op", () => {
    const once = normalizeIsraeliMobile("0541112222")!;
    expect(normalizeIsraeliMobile(once)).toBe(once);
  });
});

describe("formatIsraeliMobileForDisplay", () => {
  it("renders E.164 back as the local format users recognise", () => {
    expect(formatIsraeliMobileForDisplay("+972501234567")).toBe("050-123-4567");
  });

  it("passes through anything it can't parse rather than throwing", () => {
    expect(formatIsraeliMobileForDisplay("+14155552671")).toBe("+14155552671");
    expect(formatIsraeliMobileForDisplay(null)).toBe("");
  });
});
