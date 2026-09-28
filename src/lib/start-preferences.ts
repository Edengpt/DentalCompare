import { SPECIALTIES, type Specialty } from "./constants";

/**
 * What the patient picked in the homepage search box, carried into the request
 * flow as defaults.
 *
 * A cookie rather than query parameters because the flow has four hops before
 * the choice matters (sign-up, /request/new, upload, travel) and two of them
 * are redirects we don't own. Every one of them would have to forward the
 * parameters, and the one that forgets drops them silently.
 *
 * These are DEFAULTS, never decisions: the travel step still asks, and the
 * specialty is an ordinary filter the patient can clear. Nothing here is
 * trusted — parseStartPreferences throws away anything it doesn't recognise.
 */
export const START_PREFERENCES_COOKIE = "dc_start";

/** A day: long enough to survive sign-up, short enough not to haunt a later visit. */
export const START_PREFERENCES_MAX_AGE = 60 * 60 * 24;

export type StartPreferences = {
  specialty: Specialty | null;
  /**
   * ISO 3166-1 alpha-2 code of the country picked under "where?", or null for
   * "anywhere". Only its shape is checked here; the travel step compares it with
   * the active countries, so a code we stopped operating in simply falls away.
   */
  country: string | null;
};

const EMPTY: StartPreferences = { specialty: null, country: null };

export function parseStartPreferences(raw: string | undefined | null): StartPreferences {
  if (!raw) return EMPTY;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (!value || typeof value !== "object") return EMPTY;
  const { specialty, country } = value as Record<string, unknown>;
  return {
    specialty:
      typeof specialty === "string" && (SPECIALTIES as readonly string[]).includes(specialty)
        ? (specialty as Specialty)
        : null,
    country: typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : null,
  };
}

export function serializeStartPreferences(prefs: StartPreferences): string {
  return JSON.stringify({ specialty: prefs.specialty, country: prefs.country });
}

export type TravelDefaults = {
  scope: "LOCAL" | "SELECTED" | "ANY";
  destinations: string[];
};

/**
 * Turns the homepage's "where?" into the travel step's own terms.
 *
 * The patient's home country is LOCAL, any other active country is SELECTED
 * with that one destination ticked, and "anywhere" is ANY. With no cookie at
 * all the step keeps its usual LOCAL default.
 */
export function travelDefaults(
  prefs: StartPreferences | null,
  homeCountry: string,
  activeCodes: readonly string[],
): TravelDefaults {
  if (!prefs) return { scope: "LOCAL", destinations: [] };
  const { country } = prefs;
  if (country === null) return { scope: "ANY", destinations: [] };
  if (country === homeCountry || !activeCodes.includes(country)) {
    return { scope: "LOCAL", destinations: [] };
  }
  return { scope: "SELECTED", destinations: [country] };
}
