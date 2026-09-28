/**
 * A country's name in the reader's language.
 *
 * The Country table keeps only English names (nameEn is what the admin types);
 * everything a patient or clinic reads comes from the runtime's own CLDR data
 * instead. Falls back to the English name, then the code, for a code the
 * runtime doesn't know.
 */
export function countryName(code: string, locale: string, fallback?: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? fallback ?? code;
  } catch {
    return fallback ?? code;
  }
}

/** Adds `name` in the reader's language and sorts alphabetically by it. */
export function withCountryNames<T extends { code: string; nameEn?: string }>(
  countries: T[],
  locale: string,
): (T & { name: string })[] {
  const collator = new Intl.Collator(locale);
  return countries
    .map((c) => ({ ...c, name: countryName(c.code, locale, c.nameEn) }))
    .sort((a, b) => collator.compare(a.name, b.name));
}
