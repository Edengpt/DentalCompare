import type { PublicDentistWithCapStatus } from "@/server/dentist-cap";

const REQUEST_CAP_FLOOR = 5;

/**
 * Removes clinics that hit their monthly request cap — unless doing so would
 * drop the visible count below the floor, in which case it backfills from
 * the capped-out clinics (in their existing order) until the floor is met or
 * the input is exhausted.
 *
 * The floor's job is narrow: cap enforcement alone must never be the reason
 * a patient sees fewer than 5 clinics, when 5 or more genuinely exist for
 * whatever filters they chose (city, specialty, language, insurer,
 * experience — any combination, computed upstream by the caller). It does
 * not manufacture results a patient's own narrow filtering wouldn't have
 * produced anyway — a set with 2 clinics total stays a set of 2.
 */
export function applyRequestCapFloor(
  dentists: PublicDentistWithCapStatus[],
): PublicDentistWithCapStatus[] {
  const floor = Math.min(REQUEST_CAP_FLOOR, dentists.length);
  const notAtCap = dentists.filter((d) => !d.isAtCap);
  if (notAtCap.length >= floor) return notAtCap;

  const atCap = dentists.filter((d) => d.isAtCap);
  const needed = floor - notAtCap.length;
  return [...notAtCap, ...atCap.slice(0, needed)];
}
