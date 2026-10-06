import type { TravelScope } from "@/generated/prisma/enums";

/**
 * Which countries to show a patient, given how far they said they would travel.
 *
 * Deliberately pure — no database, no React — because this is the one rule here
 * that can be wrong without any screen looking broken.
 *
 * Returns `null` for ANY rather than a list of every country code. The
 * difference looks technical and is not: a list is a list frozen at the moment
 * it was built, so a country activated tomorrow would never appear in a request
 * made today — silently. `null` means "no filter", and that stays true forever.
 */
export function destinationCountryCodes(
  scope: TravelScope,
  destinations: string[],
  patientCountry: string | null,
): string[] | null {
  if (scope === "ANY") return null;

  if (scope === "SELECTED") {
    const unique = [...new Set(destinations)];
    // An empty list would filter everything away and render a blank screen with
    // no explanation. "I picked countries" with no countries is an unfinished
    // form, not a request to show nothing.
    if (unique.length > 0) return unique;
  }

  return patientCountry ? [patientCountry] : null;
}

/**
 * Whether "only in my country" can show anyone. Patients can now live in any
 * country, most of which have no clinics yet.
 */
export function canSearchLocally(patientCountry: string | null, activeCodes: Set<string>): boolean {
  return !!patientCountry && activeCodes.has(patientCountry);
}
