import type { Prisma } from "@/generated/prisma/client";

/**
 * A clinic waiting on an admin decision: never approved, paused and since
 * reactivated in name only, or — the case this exists to catch — active from
 * before the licence-verification gate existed and never stamped since.
 * /admin/clinics's approve action (approveClinic) can act on any of them:
 * it is deliberately idempotent about re-stamping a clinic that is already
 * `isActive` (see its own comment), so widening this filter is not a
 * behavior change, just surfacing a case the button already handled.
 *
 * **Why `licenceVerifiedAt: null` has to be in here too, not just
 * `isActive: false`.** publicDentistWhere() requires `licenceVerifiedAt` —
 * added by the licence-verification migration on top of an *already live*
 * directory. A clinic approved before that migration is `isActive: true`
 * with `licenceVerifiedAt: null`: filtering only on `isActive` (as this
 * function first did) leaves it just as invisible as it was to patients —
 * vanished from the one screen that could re-stamp it, with no error
 * anywhere. That is the same failure mode dentist-public.ts warns about,
 * one layer up.
 *
 * Deliberately NOT filtered on submittedBySelf. That column is provenance —
 * true only for a self-registered clinic — not eligibility, and it defaults
 * to false for every row that predates the column (migration
 * 20260623070455_clinic_self_registration added it with no backfill).
 */
export function pendingClinicsWhere(): Prisma.DentistWhereInput {
  return { OR: [{ isActive: false }, { licenceVerifiedAt: null }] };
}
