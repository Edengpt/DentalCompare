import "server-only";
import { db } from "@/lib/db";
import { asLocale } from "@/i18n/config";
import { QUOTE_REMINDER_DAYS, isQuoteReminderDue } from "@/lib/quote-reminder";
import { sendQuoteReminderEmail } from "@/server/quote-notifications";

/**
 * Sends the "your quotes are waiting" reminder.
 *
 * A quote only helps if it is compared, and the first email is easy to miss:
 * it can land in spam, or arrive while the patient is busy. One reminder per
 * request, naming how many quotes are waiting, and never a second one for the
 * same quote. Stamped only on a successful send, so a failed send is retried
 * on the next daily run.
 */
export async function sendDueQuoteReminders(now: Date = new Date()): Promise<{
  checked: number;
  sent: number;
}> {
  const quotes = await db.quote.findMany({
    where: {
      status: "PENDING_DECISION",
      patientReminderSentAt: null,
      patientNotifiedAt: { not: null },
      createdAt: { lte: new Date(now.getTime() - QUOTE_REMINDER_DAYS * 24 * 60 * 60 * 1000) },
      requestDentist: { request: { userId: { not: null } } },
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      patientNotifiedAt: true,
      patientReminderSentAt: true,
      requestDentist: {
        select: {
          request: {
            select: {
              id: true,
              patientViewedAt: true,
              user: { select: { fullName: true, email: true, locale: true } },
            },
          },
        },
      },
    },
  });

  const byRequest = new Map<string, typeof quotes>();
  for (const q of quotes) {
    const request = q.requestDentist.request;
    if (!isQuoteReminderDue(q, request.patientViewedAt, now)) continue;
    byRequest.set(request.id, [...(byRequest.get(request.id) ?? []), q]);
  }

  let sent = 0;
  for (const [requestId, due] of byRequest) {
    const user = due[0].requestDentist.request.user;
    if (!user) continue;
    const ok = await sendQuoteReminderEmail({
      to: user.email,
      patientName: user.fullName,
      requestId,
      count: due.length,
      locale: asLocale(user.locale),
    });
    if (ok) {
      await db.quote.updateMany({
        where: { id: { in: due.map((q) => q.id) } },
        data: { patientReminderSentAt: now },
      });
      sent += 1;
    }
  }
  return { checked: quotes.length, sent };
}
