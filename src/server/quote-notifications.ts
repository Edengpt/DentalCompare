import "server-only";
import { getResend, fromAddress } from "@/lib/email";
import { newQuoteEmailHtml } from "@/server/emails/templates";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
}

export async function sendNewQuoteEmail(args: {
  to: string;
  patientName: string;
  requestId: string;
}): Promise<void> {
  const link = `${appUrl()}/request/${args.requestId}`;

  await getResend().emails.send({
    from: fromAddress(),
    to: args.to,
    subject: "קיבלת הצעת מחיר חדשה 🎉",
    html: newQuoteEmailHtml({ patientName: args.patientName, link }),
  });
}
