import "server-only";
import { db } from "./db";
import { publicDentistWhere } from "./dentist-public";

/** Below this many countries the section says less than the hero already does. */
export const DESTINATIONS_MIN = 2;
const DESTINATIONS_MAX = 5;

/**
 * Countries a patient can actually reach a clinic in, busiest first.
 *
 * Same gate as the directory (publicDentistWhere), for the reason spelled out in
 * homepage-stats.ts: a tile for a country whose only clinic lapsed would send the
 * patient into a flow that shows them nothing there.
 *
 * Codes only, no counts. "2 clinics" under a city argues against the site; the
 * clinic count earns its place in the hero once it passes its floor.
 */
export async function getHomepageDestinations(): Promise<string[]> {
  const rows = await db.dentist.findMany({
    where: publicDentistWhere(),
    select: { countryCode: true },
  });
  const counts = new Map<string, number>();
  for (const { countryCode } of rows) counts.set(countryCode, (counts.get(countryCode) ?? 0) + 1);
  const codes = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, DESTINATIONS_MAX)
    .map(([code]) => code);
  return codes.length >= DESTINATIONS_MIN ? codes : [];
}
