import { getCountries } from "libphonenumber-js";
import { countryName } from "./country-names";

/**
 * Every country a patient can say they live in.
 *
 * Not the Country table: that lists where clinics operate, and a patient in
 * Brazil flying to Istanbul must be able to say "Brazil". The list comes from
 * libphonenumber, the same source that guesses the country from a phone
 * number, so a guess is always a valid answer.
 */
const CODES = new Set(getCountries());

export function isPatientCountry(code: string): boolean {
  return CODES.has(code as never);
}

export function patientCountries(locale: string): { code: string; name: string }[] {
  const collator = new Intl.Collator(locale);
  return [...CODES]
    .map((code) => ({ code, name: countryName(code, locale) }))
    .sort((a, b) => collator.compare(a.name, b.name));
}
