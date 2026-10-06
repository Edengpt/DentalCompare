import type { Dictionary } from "@/i18n/get-dictionary";

/**
 * Display names for the canonical values stored in the database.
 *
 * The maps themselves live in the dictionaries — they are display copy, and a
 * module named *_HE can only ever be right for one language. What stays here is
 * the lookup rule, which is the same in every language: fall through to the
 * stored value when there is no label for it.
 *
 * Falling through matters. Treatments and insurers are open sets — a clinic in
 * Hungary may declare a payer nobody has written a label for — and showing the
 * raw stored value beats showing a blank.
 */
type Labels = Dictionary["labels"];

export function translateSpecialty(t: Labels, value: string): string {
  return t.specialties[value as keyof Labels["specialties"]] ?? value;
}

export function translateTreatment(t: Labels, value: string): string {
  return t.treatments[value as keyof Labels["treatments"]] ?? value;
}

export function translateInsurer(t: Labels, value: string): string {
  return t.insurers[value as keyof Labels["insurers"]] ?? value;
}

export function translateInclusion(t: Labels, value: string): string {
  return t.inclusions[value as keyof Labels["inclusions"]] ?? value;
}

export function translateLanguage(t: Labels, value: string): string {
  return t.languages[value as keyof Labels["languages"]] ?? value;
}

export function translateQuoteCategory(t: Labels, value: string): string {
  return t.quoteCategories[value as keyof Labels["quoteCategories"]] ?? value;
}

export function translateTransfer(t: Labels, value: string): string {
  return t.transfers[value as keyof Labels["transfers"]] ?? value;
}

/**
 * How one quote line reads: "Crown — Zirconia", or the clinic's own wording
 * for an OTHER line. One rule for the form and the comparison table, so the
 * clinic sees exactly the name the patient will.
 */
export function quoteItemName(
  t: Labels,
  item: { treatment: string; variant?: string | null; customLabel?: string | null },
): string {
  if (item.treatment === "OTHER" && item.customLabel) return item.customLabel;
  const name =
    t.quoteTreatments[item.treatment as keyof Labels["quoteTreatments"]] ?? item.treatment;
  if (!item.variant) return name;
  const variant = t.quoteVariants[item.variant as keyof Labels["quoteVariants"]] ?? item.variant;
  return `${name} — ${variant}`;
}
