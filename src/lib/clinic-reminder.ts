/** How long after a request reaches a clinic before it is nudged, once. */
export const CLINIC_REMINDER_HOURS = 24;

/**
 * True when a clinic should be reminded to quote.
 *
 * The patient chose three clinics and is waiting on each; a clinic that has
 * not answered after a day is most often one that missed the email, not one
 * that decided not to answer. Never once the patient has already chosen
 * another clinic — the reminder would ask for work that can no longer win.
 */
export function isClinicReminderDue(
  rd: {
    emailSent: boolean;
    sentAt: Date | null;
    hasQuote: boolean;
    disputedAt: Date | null;
    clinicReminderSentAt: Date | null;
  },
  patientAlreadyChose: boolean,
  now: Date,
): boolean {
  if (!rd.emailSent || !rd.sentAt || rd.hasQuote || rd.disputedAt || rd.clinicReminderSentAt) {
    return false;
  }
  if (patientAlreadyChose) return false;
  return now.getTime() >= rd.sentAt.getTime() + CLINIC_REMINDER_HOURS * 60 * 60 * 1000;
}
