/**
 * "2026-09" — the natural key MonthlyRequestUsage resets on every calendar
 * month, with no separate cron needed to zero it out.
 *
 * Deliberately UTC, not clinic-local or patient-local time: DentalCompare is
 * now a cross-border marketplace (see the dental-tourism pivot), so there is
 * no single "local" timezone to anchor this on, and per-clinic-timezone
 * correctness would be real complexity for a boundary that, worst case,
 * shifts a request's month bucket by at most a few hours around midnight on
 * the 1st. If this ever needs to be exact for a specific market, that's a
 * deliberate follow-up, not an oversight — this comment is that pin.
 */
export function currentYearMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}
