import { describe, it, expect } from "vitest";
import { parsePricingInput } from "./subscription-pricing";

const BASIC = {
  monthlyPriceMajor: "299",
  yearlyPriceMajor: "1990",
  trialDays: "60",
  monthlyRequestCap: "10",
  trialRequestCap: "5",
};

describe("parsePricingInput", () => {
  it("accepts valid BASIC input and converts major units to minor", () => {
    const result = parsePricingInput(BASIC, "ILS", "BASIC");
    expect(result).toEqual({
      ok: true,
      value: {
        monthlyPriceMinor: 29900,
        yearlyPriceMinor: 199000,
        trialDays: 60,
        monthlyRequestCap: 10,
        trialRequestCap: 5,
      },
    });
  });

  it("rejects a non-positive monthly price on a paid tier", () => {
    const result = parsePricingInput({ ...BASIC, monthlyPriceMajor: "0" }, "ILS", "BASIC");
    expect(result).toEqual({ ok: false, field: "monthlyPriceMajor" });
  });

  it("rejects a non-positive yearly price on a paid tier", () => {
    const result = parsePricingInput({ ...BASIC, yearlyPriceMajor: "-5" }, "ILS", "PRO");
    expect(result).toEqual({ ok: false, field: "yearlyPriceMajor" });
  });

  it("rejects a monthly price above the 100,000-major-unit ceiling", () => {
    const result = parsePricingInput({ ...BASIC, monthlyPriceMajor: "999999" }, "ILS", "BASIC");
    expect(result).toEqual({ ok: false, field: "monthlyPriceMajor" });
  });

  it("rejects trial days outside 1-365", () => {
    expect(parsePricingInput({ ...BASIC, trialDays: "0" }, "ILS", "BASIC")).toEqual({
      ok: false,
      field: "trialDays",
    });
    expect(parsePricingInput({ ...BASIC, trialDays: "400" }, "ILS", "BASIC")).toEqual({
      ok: false,
      field: "trialDays",
    });
  });

  it("rejects non-numeric input", () => {
    const result = parsePricingInput({ ...BASIC, monthlyPriceMajor: "abc" }, "ILS", "BASIC");
    expect(result).toEqual({ ok: false, field: "monthlyPriceMajor" });
  });

  it("floors a fractional trial-days input", () => {
    const result = parsePricingInput({ ...BASIC, trialDays: "60.7" }, "ILS", "BASIC");
    expect(result.ok && result.value.trialDays).toBe(60);
  });

  it("FREE tier: accepts exactly 0/0 and locks the price there", () => {
    const result = parsePricingInput(
      { ...BASIC, monthlyPriceMajor: "0", yearlyPriceMajor: "0" },
      "ILS",
      "FREE",
    );
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.monthlyPriceMinor).toBe(0);
    expect(result.ok && result.value.yearlyPriceMinor).toBe(0);
  });

  it("FREE tier: rejects any non-zero monthly price, even a valid-looking one", () => {
    const result = parsePricingInput({ ...BASIC, monthlyPriceMajor: "1" }, "ILS", "FREE");
    expect(result).toEqual({ ok: false, field: "monthlyPriceMajor" });
  });

  it("FREE tier: rejects any non-zero yearly price", () => {
    const result = parsePricingInput(
      { ...BASIC, monthlyPriceMajor: "0", yearlyPriceMajor: "1" },
      "ILS",
      "FREE",
    );
    expect(result).toEqual({ ok: false, field: "yearlyPriceMajor" });
  });

  it("parses an empty monthlyRequestCap as unlimited (null)", () => {
    const result = parsePricingInput({ ...BASIC, monthlyRequestCap: "" }, "ILS", "FEATURED");
    expect(result.ok && result.value.monthlyRequestCap).toBeNull();
  });

  it("rejects a monthlyRequestCap of 0 or negative", () => {
    expect(parsePricingInput({ ...BASIC, monthlyRequestCap: "0" }, "ILS", "BASIC")).toEqual({
      ok: false,
      field: "monthlyRequestCap",
    });
    expect(parsePricingInput({ ...BASIC, monthlyRequestCap: "-1" }, "ILS", "BASIC")).toEqual({
      ok: false,
      field: "monthlyRequestCap",
    });
  });

  it("floors a fractional monthlyRequestCap", () => {
    const result = parsePricingInput({ ...BASIC, monthlyRequestCap: "10.9" }, "ILS", "BASIC");
    expect(result.ok && result.value.monthlyRequestCap).toBe(10);
  });

  it("rejects trialRequestCap outside 1-1000", () => {
    expect(parsePricingInput({ ...BASIC, trialRequestCap: "0" }, "ILS", "BASIC")).toEqual({
      ok: false,
      field: "trialRequestCap",
    });
    expect(parsePricingInput({ ...BASIC, trialRequestCap: "1001" }, "ILS", "BASIC")).toEqual({
      ok: false,
      field: "trialRequestCap",
    });
  });
});
