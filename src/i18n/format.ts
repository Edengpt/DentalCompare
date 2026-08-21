/**
 * Interpolation for dictionary strings.
 *
 * Entries that take a value are templates like "Sent to {count} clinics", not
 * functions. Functions would be the obvious choice, but the whole dictionary is
 * handed to a client provider, and React cannot serialise a function across the
 * server/client boundary — it fails the build with "Functions cannot be passed
 * directly to Client Components". Templates are plain data and cross it fine.
 */
export function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/** A string that reads differently for one item and for several. */
export type Plural = { one: string; other: string };

/**
 * Picks the singular or plural form and interpolates it.
 *
 * Deliberately a two-form rule, which covers English and Hebrew for the counts
 * this app shows. A language with more categories (Russian, Arabic, Polish)
 * would need Intl.PluralRules here — swap this out then, rather than bending
 * the call sites around it.
 */
export function plural(forms: Plural, count: number, extra: Record<string, string | number> = {}) {
  return format(count === 1 ? forms.one : forms.other, { count, ...extra });
}
