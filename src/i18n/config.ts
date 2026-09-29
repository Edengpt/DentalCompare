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
export const locales = ["en", "he", "ru", "fr", "de", "zh", "tr"] as const;

export type Locale = (typeof locales)[number];

/**
 * Hebrew stays the default. Israel is the only live market, and defaulting the
 * whole site to English would be a regression for every current user.
 */
export const defaultLocale: Locale = "he";

export const dir: Record<Locale, "rtl" | "ltr"> = {
  en: "ltr",
  he: "rtl",
  ru: "ltr",
  fr: "ltr",
  de: "ltr",
  zh: "ltr",
  tr: "ltr",
};

/** Locale label in its own language — never translated, per convention. */
export const localeNames: Record<Locale, string> = {
  en: "English",
  he: "עברית",
  ru: "Русский",
  fr: "Français",
  de: "Deutsch",
  zh: "中文",
  tr: "Türkçe",
};

/**
 * The full tag for Intl formatting (dates, numbers) and hreflang. The site is
 * localised by language; the region only picks conventions such as day-month
 * order, and zh means Simplified Chinese.
 */
export const intlLocale: Record<Locale, string> = {
  en: "en-GB",
  he: "he-IL",
  ru: "ru-RU",
  fr: "fr-FR",
  de: "de-DE",
  zh: "zh-CN",
  tr: "tr-TR",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Cookie the proxy writes and reads to remember an explicit language choice. */
export const LOCALE_COOKIE = "NEXT_LOCALE";

/**
 * Narrows a locale string read from the database.
 *
 * User.locale and Dentist.locale are plain columns, so nothing stops a stale or
 * hand-edited row holding something we don't serve. Falling back beats throwing
 * in a cron: a renewal notice in the wrong language is recoverable, a crashed
 * billing run is not.
 */
export function asLocale(value: string | null | undefined): Locale {
  return value && isLocale(value) ? value : defaultLocale;
}
