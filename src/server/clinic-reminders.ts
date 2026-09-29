import "server-only";
import { db } from "@/lib/db";
import { asLocale } from "@/i18n/config";
import { appUrl } from "@/lib/app-url";
import { quotePath } from "@/lib/quotes";
import { getResend, fromAddress } from "@/lib/email";
import { getDictionary } from "@/i18n/get-dictionary";
import { clinicQuoteReminderEmailHtml } from "@/server/emails/templates";
import { CLINIC_REMINDER_HOURS, isClinicReminderDue } from "@/lib/clinic-reminder";

/**
 * Sends the one "a patient is waiting for your quote" reminder per clinic
 * per request. Stamped only on a successful send, so a failed send is
 * retried on the next daily run.
 */
export async function sendDueClinicReminders(now: Date = new Date()): Promise<{
  checked: number;
  sent: number;
}> {
  const rows = await db.requestDentist.findMany({
    where: {
      emailSent: true,
      clinicReminderSentAt: null,
      disputedAt: null,
      quote: null,
      quoteToken: { not: null },
      sentAt: { lte: new Date(now.getTime() - CLINIC_REMINDER_HOURS * 60 * 60 * 1000) },
      request: { status: "SENT" },
    },
    select: {
      id: true,
      emailSent: true,
      sentAt: true,
      disputedAt: true,
      clinicReminderSentAt: true,
      quoteToken: true,
      dentist: { select: { email: true, clinicName: true, locale: true } },
      request: {
        select: {
          requestDentists: { select: { quote: { select: { status: true } } } },
        },
      },
    },
  });

  let sent = 0;
  for (const rd of rows) {
    const patientAlreadyChose = rd.request.requestDentists.some(
      (s) => s.quote && s.quote.status !== "PENDING_DECISION" && s.quote.status !== "REJECTED",
    );
    if (
      !rd.quoteToken ||
      !isClinicReminderDue({ ...rd, hasQuote: false }, patientAlreadyChose, now)
    ) {
      continue;
    }
    const locale = asLocale(rd.dentist.locale);
    const t = (await getDictionary(locale)).emails;
    try {
      const { error } = await getResend().emails.send({
        from: fromAddress(),
        to: rd.dentist.email,
        subject: t.subjectClinicQuoteReminder,
        html: clinicQuoteReminderEmailHtml({
          locale,
          t,
          clinicName: rd.dentist.clinicName,
          quoteUrl: `${appUrl()}${quotePath(rd.quoteToken)}`,
        }),
      });
      if (error) throw new Error(error.message ?? "Resend error");
      await db.requestDentist.update({
        where: { id: rd.id },
        data: { clinicReminderSentAt: now },
      });
      sent += 1;
    } catch (err) {
      console.error(`Failed to send clinic quote reminder for ${rd.id}:`, err);
    }
  }
  return { checked: rows.length, sent };
}
