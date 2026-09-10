import "server-only";
import { db } from "@/lib/db";
import { currentYearMonth } from "@/lib/date";
import type { PublicDentist } from "@/lib/dentist-public";

export type PublicDentistWithCapStatus = PublicDentist & { isAtCap: boolean };

/**
 * Attaches whether each clinic has hit its monthly request cap this calendar
 * month — the signal the client-side directory filter needs to drop capped
 * clinics from view (src/components/dentists/request-cap-filter.ts handles
 * the drop-and-backfill logic itself; this function only computes the flag).
 *
 * Reads ClinicSubscription.monthlyRequestCap (frozen at registration, null
 * means unlimited) and MonthlyRequestUsage for the current month — never the
 * live SubscriptionPricing row, so an admin editing a tier's cap today never
 * retroactively changes what an existing clinic already agreed to.
 *
 * Lives outside src/lib/dentist-public.ts deliberately, even though it
 * operates on the same PublicDentist shape: that file is imported by code
 * that has no reason to load a database client (e.g. dentist-public.test.ts,
 * a pure unit test of the where/select builders), and this function's own
 * `import { db }` would otherwise force every one of those importers to
 * require DATABASE_URL just to load, even when they never call this
 * function. Keep it here, not merged back.
 */
export async function attachCapStatus(
  dentists: PublicDentist[],
): Promise<PublicDentistWithCapStatus[]> {
  if (dentists.length === 0) return [];
  const ids = dentists.map((d) => d.id);
  const yearMonth = currentYearMonth();

  const [subs, usage] = await Promise.all([
    db.clinicSubscription.findMany({
      where: { dentistId: { in: ids } },
      select: { dentistId: true, monthlyRequestCap: true },
    }),
    db.monthlyRequestUsage.findMany({
      where: { dentistId: { in: ids }, yearMonth },
      select: { dentistId: true, count: true },
    }),
  ]);

  const capByDentist = new Map(subs.map((s) => [s.dentistId, s.monthlyRequestCap]));
  const usageByDentist = new Map(usage.map((u) => [u.dentistId, u.count]));

  return dentists.map((d) => {
    const cap = capByDentist.get(d.id) ?? null;
    const used = usageByDentist.get(d.id) ?? 0;
    return { ...d, isAtCap: cap !== null && used >= cap };
  });
}
