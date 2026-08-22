import "server-only";
import { getResend, fromAddress } from "@/lib/email";
import { newQuoteEmailHtml } from "@/server/emails/templates";
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
