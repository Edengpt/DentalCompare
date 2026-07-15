import "server-only";
import { getResend, fromAddress } from "@/lib/email";
import { newQuoteEmailHtml } from "@/server/emails/templates";
import { appUrl } from "@/lib/app-url";

export async function sendNewQuoteEmail(args: {
  to: string;
  patientName: string;
  requestId: string;
}): Promise<boolean> {
  const link = `${appUrl()}/request/${args.requestId}`;

  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: args.to,
      subject: "קיבלת הצעת מחיר חדשה 🎉",
      html: newQuoteEmailHtml({ patientName: args.patientName, link }),
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
