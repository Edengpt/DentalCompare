/**
 * What the patient can narrow the clinic list by, and how a clinic is judged
 * against it.
 *
 * Kept apart from the panel that renders it so the rule can be tested without a
 * browser: within a group any chosen value is enough ("Haifa or Tel Aviv"),
 * across groups all must hold ("in Haifa and speaks Russian") — the same way a
 * Booking sidebar reads.
 */
export type DentistFilters = {
  cities: string[];
  countries: string[];
  languages: string[];
  specialties: string[];
  insurers: string[];
  minExperience: number | null;
};

export const EMPTY_FILTERS: DentistFilters = {
  cities: [],
  countries: [],
  languages: [],
  specialties: [],
  insurers: [],
  minExperience: null,
};

export type FilterableDentist = {
  city: string;
  countryCode: string;
  spokenLanguages: string[];
  specialties: string[];
  insurerAffiliations: string[];
  experienceYears: number;
};

const anyOf = (chosen: string[], has: string[]) =>
  chosen.length === 0 || chosen.some((v) => has.includes(v));

export function matchesFilters(d: FilterableDentist, f: DentistFilters): boolean {
  return (
    anyOf(f.cities, [d.city]) &&
    anyOf(f.countries, [d.countryCode]) &&
    anyOf(f.languages, d.spokenLanguages) &&
    anyOf(f.specialties, d.specialties) &&
    anyOf(f.insurers, d.insurerAffiliations) &&
    (!f.minExperience || d.experienceYears >= f.minExperience)
  );
}

/** For the badge on the mobile "Filters" button. */
export function activeFilterCount(f: DentistFilters): number {
  return (
    f.cities.length +
    f.countries.length +
    f.languages.length +
    f.specialties.length +
    f.insurers.length +
    (f.minExperience ? 1 : 0)
  );
}
