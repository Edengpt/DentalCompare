import { describe, expect, it } from "vitest";
import {
  EMPTY_FILTERS,
  activeFilterCount,
  matchesFilters,
  type DentistFilters,
  type FilterableDentist,
} from "./dentist-filters";

const clinic = (over: Partial<FilterableDentist> = {}): FilterableDentist => ({
  city: "Haifa",
  countryCode: "IL",
  spokenLanguages: ["he", "en"],
  specialties: ["implants"],
  insurerAffiliations: ["clalit"],
  experienceYears: 12,
  ...over,
});

const f = (over: Partial<DentistFilters>): DentistFilters => ({ ...EMPTY_FILTERS, ...over });

describe("matchesFilters", () => {
  it("lets everything through when nothing is chosen", () => {
    expect(matchesFilters(clinic(), EMPTY_FILTERS)).toBe(true);
  });

  it("matches any of several chosen cities", () => {
    expect(matchesFilters(clinic({ city: "Haifa" }), f({ cities: ["Tel Aviv", "Haifa"] }))).toBe(
      true,
    );
    expect(matchesFilters(clinic({ city: "Eilat" }), f({ cities: ["Tel Aviv", "Haifa"] }))).toBe(
      false,
    );
  });

  it("matches a clinic having any one of the chosen values within a group", () => {
    expect(matchesFilters(clinic(), f({ specialties: ["orthodontics", "implants"] }))).toBe(true);
    expect(matchesFilters(clinic(), f({ languages: ["ru"] }))).toBe(false);
    expect(matchesFilters(clinic(), f({ insurers: ["maccabi"] }))).toBe(false);
    expect(matchesFilters(clinic(), f({ countries: ["HU"] }))).toBe(false);
  });

  it("requires every group to match at once", () => {
    const filters = f({ cities: ["Haifa"], languages: ["ru"] });
    expect(matchesFilters(clinic(), filters)).toBe(false);
  });

  it("treats experience as a minimum", () => {
    expect(matchesFilters(clinic({ experienceYears: 10 }), f({ minExperience: 10 }))).toBe(true);
    expect(matchesFilters(clinic({ experienceYears: 9 }), f({ minExperience: 10 }))).toBe(false);
  });
});

describe("activeFilterCount", () => {
  it("counts each chosen value, and experience as one", () => {
    expect(activeFilterCount(EMPTY_FILTERS)).toBe(0);
    expect(
      activeFilterCount(f({ cities: ["Haifa", "Eilat"], languages: ["en"], minExperience: 5 })),
    ).toBe(4);
  });
});
