import { addMonths } from "./subscription";

/**
 * When a treatment's warranty runs out: the clinic's stated years, counted
 * from the day the treatment was confirmed complete. Null while there is
 * nothing to count from — no warranty given, or the treatment isn't done.
 *
 * This is the one date a patient treated abroad most needs to keep, and the
 * one nobody writes down.
 */
export function warrantyEndsAt(
  completedAt: Date | null,
  warrantyYears: number | null,
): Date | null {
  if (!completedAt || warrantyYears === null || warrantyYears <= 0) return null;
  return addMonths(completedAt, warrantyYears * 12);
}
