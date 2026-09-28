import { describe, it, expect } from "vitest";
import { countryName, withCountryNames } from "./country-names";

describe("countryName", () => {
  it("names a country in the reader's language", () => {
    expect(countryName("HU", "en")).toBe("Hungary");
    expect(countryName("HU", "he")).toBe("הונגריה");
  });

  it("falls back to the English name, then the code", () => {
    expect(countryName("not-a-code", "en", "Somewhere")).toBe("Somewhere");
    expect(countryName("not-a-code", "en")).toBe("not-a-code");
  });
});

describe("withCountryNames", () => {
  it("sorts by the name in the reader's language", () => {
    const list = [{ code: "TR" }, { code: "AZ" }, { code: "HU" }];
    expect(withCountryNames(list, "en").map((c) => c.name)).toEqual([
      "Azerbaijan",
      "Hungary",
      "Türkiye",
    ]);
  });
});
