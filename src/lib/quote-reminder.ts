/** How long a quote may sit unopened before the patient is reminded, once. */
export const QUOTE_REMINDER_DAYS = 3;

/**
 * True when a quote should be part of a reminder: it is old enough, still
 * waiting for the patient's decision, and the patient has not opened the
 * request page since it arrived. The first "new quote" email must have gone
 * out, or the reminder would be the first the patient hears of it.
 */
export function isQuoteReminderDue(
  quote: {
    createdAt: Date;
    status: string;
    patientNotifiedAt: Date | null;
    patientReminderSentAt: Date | null;
  },
  patientViewedAt: Date | null,
  now: Date,
): boolean {
  if (quote.status !== "PENDING_DECISION") return false;
  if (!quote.patientNotifiedAt || quote.patientReminderSentAt) return false;
  const dueAt = quote.createdAt.getTime() + QUOTE_REMINDER_DAYS * 24 * 60 * 60 * 1000;
  if (now.getTime() < dueAt) return false;
  return !patientViewedAt || patientViewedAt.getTime() < quote.createdAt.getTime();
}
