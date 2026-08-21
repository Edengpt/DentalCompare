/**
 * Supported locales.
 *
 * Structured for N locales from the start rather than the two that exist today:
 * a dental-tourism marketplace recruiting patients from Germany or Turkey will
 * need their languages, and retrofitting that is far more expensive than
 * carrying the shape now. Adding one is a dictionary file plus a line here —
 * and a line in PROTECTED_PATTERNS (see src/proxy-routes.ts), which is the
 * easy one to forget.
 */
export const locales = ["he", "en"] as const;

export type Locale = (typeof locales)[number];

/**
 * Hebrew stays the default. Israel is the only live market, and defaulting the
 * whole site to English would be a regression for every current user.
 */
export const defaultLocale: Locale = "he";

export const dir: Record<Locale, "rtl" | "ltr"> = { he: "rtl", en: "ltr" };

/** Locale label in its own language — never translated, per convention. */
export const localeNames: Record<Locale, string> = { he: "עברית", en: "English" };

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Cookie the proxy writes and reads to remember an explicit language choice. */
export const LOCALE_COOKIE = "NEXT_LOCALE";
