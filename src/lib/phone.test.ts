import { describe, it, expect } from "vitest";
import { normalizePhone, formatPhoneForDisplay, countryFromPhone } from "./phone";

/**
 * Fixtures use the subscriber suffix 5555555 deliberately. The mobile metadata
 * validates against real allocated ranges, and the obvious 1234567 is NOT
 * allocated under most Israeli mobile prefixes — it is a fake number that only
 * a length-based check would accept. 5555555 is valid under all nine.
 */
describe("normalizePhone — Israeli regression", () => {
  it("normalises the common local formats to E.164", () => {
    for (const input of [
      "0505555555",
      "050-555-5555",
      "050 555 5555",
      "+972505555555",
      "+972-50-555-5555",
      "972505555555",
      "00972505555555",
    ]) {
      expect(normalizePhone(input, "IL")).toBe("+972505555555");
    }
  });

  it("accepts every allocated mobile prefix", () => {
    for (const p of ["050", "051", "052", "053", "054", "055", "056", "058", "059"]) {
      expect(normalizePhone(`${p}5555555`, "IL")).toBe(`+972${p.slice(1)}5555555`);
    }
  });

  it("still rejects Israeli landlines — the mobile gate is a product rule", () => {
    for (const input of ["031234567", "0212345678", "089123456", "+97231234567"]) {
      expect(normalizePhone(input, "IL")).toBeNull();
    }
  });

  it("rejects wrong lengths and junk", () => {
    for (const input of ["050555555", "05055555555", "", "   ", "not a phone", "05a5555555"]) {
      expect(normalizePhone(input, "IL")).toBeNull();
    }
  });

  it("is idempotent", () => {
    const once = normalizePhone("0545555555", "IL")!;
    expect(normalizePhone(once, "IL")).toBe(once);
  });
});

describe("normalizePhone — international", () => {
  it("accepts mobiles from other countries in international form", () => {
    expect(normalizePhone("+447911123456")).toBe("+447911123456"); // UK
    expect(normalizePhone("+905321234567")).toBe("+905321234567"); // Turkey
    expect(normalizePhone("+36201234567")).toBe("+36201234567"); // Hungary
  });

  it("uses the country hint to read a local-format number", () => {
    expect(normalizePhone("07911 123456", "GB")).toBe("+447911123456");
    expect(normalizePhone("0532 123 45 67", "TR")).toBe("+905321234567");
  });

  it("lets an explicit international prefix win over a wrong country hint", () => {
    expect(normalizePhone("+447911123456", "IL")).toBe("+447911123456");
  });

  it("accepts US numbers, where mobile and landline are indistinguishable", () => {
    // libphonenumber reports FIXED_LINE_OR_MOBILE here. Rejecting that would
    // lock out every US patient, which is worse than admitting a landline.
    expect(normalizePhone("+14155552671")).toBe("+14155552671");
  });

  it("rejects unparseable input with no country hint", () => {
    expect(normalizePhone("0505555555")).toBeNull(); // ambiguous without a country
    expect(normalizePhone("+999999999999")).toBeNull();
  });
});

describe("formatPhoneForDisplay", () => {
  it("renders Israeli numbers in the local format users recognise", () => {
    expect(formatPhoneForDisplay("+972505555555")).toBe("050-555-5555");
  });

  it("renders foreign numbers in their own national format", () => {
    expect(formatPhoneForDisplay("+447911123456")).toBe("07911 123456");
  });

  it("passes through anything it can't parse rather than throwing", () => {
    expect(formatPhoneForDisplay("nonsense")).toBe("nonsense");
    expect(formatPhoneForDisplay(null)).toBe("");
  });
});

describe("countryFromPhone", () => {
  it("reads the country out of a stored number", () => {
    expect(countryFromPhone("+972501234567")).toBe("IL");
    expect(countryFromPhone("+905321234567")).toBe("TR");
    expect(countryFromPhone("+13475551234")).toBe("US");
  });

  // +44 is shared between the UK and the crown dependencies, and a mobile range
  // can resolve to Guernsey rather than Great Britain. Worth knowing, because
  // the UK is a source market and Guernsey is not the UK for privacy purposes —
  // which is exactly why this only pre-fills the question instead of answering
  // it.
  it("can resolve a +44 mobile to a crown dependency, not the UK", () => {
    expect(countryFromPhone("+447911123456")).toBe("GG");
  });

  // It pre-fills a question rather than answering it, so an unreadable number
  // is a missing default and not an error.
  it.each([null, undefined, "", "not a phone", "+999"])("returns null for %o", (input) => {
    expect(countryFromPhone(input)).toBeNull();
  });
});
