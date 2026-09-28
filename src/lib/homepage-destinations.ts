import "server-only";
import { db } from "./db";
import { publicDentistWhere } from "./dentist-public";

export type HomepageDestination = {
  code: string;
  /** Clinics a patient can actually reach there, by the directory's own gate. */
  clinics: number;
};

/**
 * Every active country, busiest first, for the "popular destinations" tiles and
 * the "where?" list of the search box.
 *
 * Counted with the directory's gate (publicDentistWhere), for the reason spelled
 * out in homepage-stats.ts: a clinic whose licence lapsed is not a clinic the
 * patient can reach, so it must not inflate the number on the tile.
 *
 * Countries with no reachable clinic yet are still listed — the admin switched
 * them on, and a request there waits for the clinics that are joining.
 */
export async function getHomepageDestinations(): Promise<HomepageDestination[]> {
  const [countries, rows] = await Promise.all([
    db.country.findMany({ where: { isActive: true }, select: { code: true } }),
    db.dentist.groupBy({
      by: ["countryCode"],
      where: publicDentistWhere(),
      _count: { _all: true },
    }),
  ]);
  const counts = new Map(rows.map((r) => [r.countryCode, r._count._all]));
  return countries
    .map(({ code }) => ({ code, clinics: counts.get(code) ?? 0 }))
    .sort((a, b) => b.clinics - a.clinics || a.code.localeCompare(b.code));
}
