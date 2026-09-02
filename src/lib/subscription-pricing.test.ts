import { describe, it, expect } from "vitest";
import { parsePricingInput } from "./subscription-pricing";

describe("parsePricingInput", () => {
  it("accepts valid input and converts major units to minor", () => {
    const result = parsePricingInput(
      { monthlyPriceMajor: "299", yearlyPriceMajor: "1990", trialDays: "60" },
      "ILS",
    );
    expect(result).toEqual({
      ok: true,
      value: { monthlyPriceMinor: 29900, yearlyPriceMinor: 199000, trialDays: 60 },
    });
  });

  it("rejects a non-positive monthly price", () => {
    const result = parsePricingInput(
      { monthlyPriceMajor: "0", yearlyPriceMajor: "1990", trialDays: "60" },
      "ILS",
    );
    expect(result).toEqual({ ok: false, field: "monthlyPriceMajor" });
  });

  it("rejects a non-positive yearly price", () => {
    const result = parsePricingInput(
      { monthlyPriceMajor: "299", yearlyPriceMajor: "-5", trialDays: "60" },
      "ILS",
    );
    expect(result).toEqual({ ok: false, field: "yearlyPriceMajor" });
  });

  it("rejects trial days outside 1-365", () => {
    expect(
      parsePricingInput({ monthlyPriceMajor: "299", yearlyPriceMajor: "1990", trialDays: "0" }, "ILS"),
    ).toEqual({ ok: false, field: "trialDays" });
    expect(
      parsePricingInput(
        { monthlyPriceMajor: "299", yearlyPriceMajor: "1990", trialDays: "400" },
        "ILS",
      ),
    ).toEqual({ ok: false, field: "trialDays" });
  });

  it("rejects non-numeric input", () => {
    const result = parsePricingInput(
      { monthlyPriceMajor: "abc", yearlyPriceMajor: "1990", trialDays: "60" },
      "ILS",
    );
    expect(result).toEqual({ ok: false, field: "monthlyPriceMajor" });
  });

  it("floors a fractional trial-days input", () => {
    const result = parsePricingInput(
      { monthlyPriceMajor: "299", yearlyPriceMajor: "1990", trialDays: "60.7" },
      "ILS",
    );
    expect(result).toEqual({
      ok: true,
      value: { monthlyPriceMinor: 29900, yearlyPriceMinor: 199000, trialDays: 60 },
    });
  });
});
