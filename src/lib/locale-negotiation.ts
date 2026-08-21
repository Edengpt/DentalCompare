import { defaultLocale, isLocale, type Locale } from "@/i18n/config";

/**
 * Picks a locale for a request that doesn't carry one in its path.
 *
 * Order is deliberate: an explicit choice the visitor made (the cookie) beats
 * what their browser happens to advertise. Getting that backwards would keep
 * overriding a visitor who switched language on purpose.
 */
export function negotiateLocale(
  cookie: string | undefined,
  acceptLanguage: string | null,
): Locale {
  if (cookie && isLocale(cookie)) return cookie;

  // Accept-Language is a q-weighted list ("en-GB,en;q=0.9,he;q=0.8"). Browsers
  // send it in preference order, so first supported match wins; the region is
  // dropped because the site is localised by language, not territory.
  for (const part of acceptLanguage?.split(",") ?? []) {
    const tag = part.split(";")[0]?.trim().toLowerCase().split("-")[0];
    if (tag && isLocale(tag)) return tag;
  }

  return defaultLocale;
}

/**
 * True for a first path segment that looks like a language code but isn't one
 * we serve.
 *
 * Those get a 404 rather than a redirect. Sending /de/request to
 * /he/de/request would 404 anyway, at a misleading URL, and hide the fact that
 * someone is linking to a language the site doesn't have.
 */
export function isUnsupportedLocaleSegment(segment: string): boolean {
  return /^[a-z]{2}$/.test(segment) && !isLocale(segment);
}
