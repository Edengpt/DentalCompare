import { describe, it, expect } from "vitest";
import { isPatientCountry, patientCountries } from "./patient-countries";

describe("patientCountries", () => {
  it("offers every country, not only the ones with clinics", () => {
    const codes = patientCountries("en").map((c) => c.code);
    expect(codes.length).toBeGreaterThan(200);
    expect(codes).toEqual(expect.arrayContaining(["BR", "US", "NG", "IL", "TR"]));
  });

  it("names countries in the reader's language, sorted by that name", () => {
    const he = patientCountries("he");
    expect(he.find((c) => c.code === "BR")?.name).toBe("ברזיל");
    const names = he.map((c) => c.name);
    expect(names).toEqual([...names].sort(new Intl.Collator("he").compare));
  });
});

describe("isPatientCountry", () => {
  it("accepts any real country code and rejects anything else", () => {
    expect(isPatientCountry("BR")).toBe(true);
    expect(isPatientCountry("XX")).toBe(false);
    expect(isPatientCountry("")).toBe(false);
  });
});
