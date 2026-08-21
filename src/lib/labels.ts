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
