import "server-only";
import { getResend, fromAddress } from "@/lib/email";
import { newQuoteEmailHtml, quoteReminderEmailHtml } from "@/server/emails/templates";
import { appUrl } from "@/lib/app-url";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

export async function sendNewQuoteEmail(args: {
  to: string;
  patientName: string | null;
  requestId: string;
  /** The recipient's own language, from User.locale — a cron sending this at
   *  4am has no request to read it from. */
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const link = `${appUrl()}/${args.locale}/request/${args.requestId}`;

  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.to,
      subject: t.subjectNewQuote,
      html: newQuoteEmailHtml({ locale: args.locale, t, patientName: args.patientName, link }),
    });
    if (error) {
      console.error(`Resend error for new-quote ${args.to}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send new-quote email to ${args.to}:`, err);
    return false;
  }
}

/** One reminder per request, covering every quote the patient hasn't opened. */
export async function sendQuoteReminderEmail(args: {
  to: string;
  patientName: string | null;
  requestId: string;
  count: number;
  locale: Locale;
}): Promise<boolean> {
  const t = (await getDictionary(args.locale)).emails;
  const link = `${appUrl()}/${args.locale}/request/${args.requestId}`;
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.to,
      subject: t.subjectQuoteReminder,
      html: quoteReminderEmailHtml({
        locale: args.locale,
        t,
        patientName: args.patientName,
        count: args.count,
        link,
      }),
    });
    if (error) {
      console.error(`Resend error for quote reminder ${args.to}:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Failed to send quote reminder to ${args.to}:`, err);
    return false;
  }
}
