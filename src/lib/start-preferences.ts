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

export type StartScope = "LOCAL" | "ANY";

export type StartPreferences = {
  specialty: Specialty | null;
  scope: StartScope | null;
};

const EMPTY: StartPreferences = { specialty: null, scope: null };

export function parseStartPreferences(raw: string | undefined | null): StartPreferences {
  if (!raw) return EMPTY;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (!value || typeof value !== "object") return EMPTY;
  const { specialty, scope } = value as Record<string, unknown>;
  return {
    specialty:
      typeof specialty === "string" && (SPECIALTIES as readonly string[]).includes(specialty)
        ? (specialty as Specialty)
        : null,
    scope: scope === "LOCAL" || scope === "ANY" ? scope : null,
  };
}

export function serializeStartPreferences(prefs: StartPreferences): string {
  return JSON.stringify({ specialty: prefs.specialty, scope: prefs.scope });
}
