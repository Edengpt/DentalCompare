import type { Prisma } from "@/generated/prisma/client";

/**
 * A clinic waiting on an admin decision: never approved, or approved once and
 * since paused — either way, /admin/clinics's approve/reject actions can act
 * on it. approveClinic is deliberately idempotent about re-activating a
 * clinic that was already approved before (see its own comment) — so folding
 * "paused" and "never approved" into one queue is not a behavior change,
 * just exposing a case the button already handled.
 *
 * Deliberately NOT filtered on submittedBySelf. That column is provenance —
 * true only for a self-registered clinic — not eligibility, and it defaults
 * to false for every row that predates the column (migration
 * 20260623070455_clinic_self_registration added it with no backfill). A
 * clinic that registered before that column existed and was never approved
 * is still `isActive: false` today, but `submittedBySelf: false` — filtering
 * on that flag made it invisible in the only screen that can approve it.
 */
export function pendingClinicsWhere(): Prisma.DentistWhereInput {
  return { isActive: false };
}
