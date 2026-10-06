import { describe, it, expect } from "vitest";
import { EXAMPLE_QUOTES, formatExampleMoney } from "./example-quotes";

describe("example quotes", () => {
  it("formats an example price without decimals, in the page's locale", () => {
    expect(formatExampleMoney("en", 2400, "GBP")).toBe("£2,400");
    // Intl puts a no-break space between the number and the symbol.
    expect(formatExampleMoney("de", 1450, "EUR")).toBe("1.450 €");
  });

  it("keeps the three clinics the homepage compares, in order", () => {
    expect(EXAMPLE_QUOTES.map((q) => q.id)).toEqual(["A", "B", "C"]);
  });

  it("marks exactly one quote as the lowest, and it is clinic B's", () => {
    const lowest = EXAMPLE_QUOTES.filter((q) => q.lowest);
    expect(lowest.map((q) => q.id)).toEqual(["B"]);
  });
});
